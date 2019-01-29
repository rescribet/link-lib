import {
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    NON_AUTHORITATIVE_INFORMATION,
    NOT_FOUND,
} from "http-status-codes";
import {
    BlankNode,
    Fetcher,
    FetchOpts,
    IndexedFormula,
    Literal,
    NamedNode,
    Quadruple,
    Serializer,
    Statement,
    uri as Uri,
} from "rdflib";

import { LinkedDataAPI } from "../LinkedDataAPI";
import { RDFStore } from "../RDFStore";
import {
    DataProcessorOpts,
    DataTuple,
    DeltaProcessor,
    EmptyRequestStatus,
    ErrorReporter,
    FailedResponse,
    FulfilledRequestStatus,
    LinkedActionResponse,
    MiddlewareActionHandler,
    ResourceQueueItem,
    ResponseAndFallbacks,
    ResponseTransformer,
} from "../types";
import { anyRDFValue } from "../utilities";
import {
    defaultNS,
    F_NTRIPLES,
    MSG_BAD_REQUEST,
    MSG_INCORRECT_TARGET,
    MSG_OBJECT_NOT_IRI,
    MSG_URL_UNDEFINED,
    MSG_URL_UNRESOLVABLE,
} from "../utilities/constants";
import { patchRDFLibSerializer } from "../utilities/monkeys";
import {
    getContentType,
    getHeader,
    getJSON,
    getURL,
} from "../utilities/responses";

import { ProcessorError } from "./ProcessorError";
import { RequestInitGenerator } from "./RequestInitGenerator";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS", "CONNECT", "TRACE"];
const FETCHER_CALLBACKS = ["done", "fail", "refresh", "request", "retract"];

async function handleStatus(res: ResponseAndFallbacks): Promise<ResponseAndFallbacks> {
    if (res.status === NOT_FOUND) {
        throw {
            message: `404: '${getURL(res)}' could not be found`,
            res,
        } as FailedResponse;
    } else if (res.status >= BAD_REQUEST && res.status < INTERNAL_SERVER_ERROR) {
        if ((getHeader(res, "Content-Type") || "").includes("json")) {
            const body = await getJSON(res);
            throw {
                message: "errors" in body ? body.errors && body.errors[0] && body.errors[0].message : "",
                res,
            } as FailedResponse;
        }

        throw {
            message: `404: '${getURL(res)}' could not be found`,
            res,
        } as FailedResponse;
    } else if (res.status >= INTERNAL_SERVER_ERROR) {
        return Promise.reject({
            message: "Internal server error",
            res,
        } as FailedResponse);
    }

    return res;
}

/**
 * Pushes in-place value {v} onto an array under key {k} of Map {map}.
 * @param map The reference to the Map to add the data to.
 * @param k The key on {map}. An array is initialized when it doesn't yet exists.
 * @param v The value to push on the array under {k}.
 */
function pushToMap<T>(map: { [key: string]: T[] }, k: string, v: T): void {
    if (typeof map[k] === "undefined") {
        map[k] = [];
    }
    map[k].push(v);
}

/**
 * Saves response metadata into a graph.
 * @param iri The original iri that was fetched.
 * @param res The (fetch) response object from the request.
 * @returns A graph with metadata about the response.
 */
function processResponse(iri: string | NamedNode, res: Response): Statement[] {
    const rawURL = getURL(res);
    const origin = iri instanceof NamedNode ? iri.site() : NamedNode.find(new URL(rawURL).origin);
    if (rawURL && iri !== rawURL) {
        return [
            new Statement(
                NamedNode.find(iri),
                NamedNode.find("http://www.w3.org/2002/07/owl#sameAs"),
                NamedNode.find(rawURL),
                origin,
            ),
        ];
    }

    return [];
}

export const emptyRequest = Object.freeze({
    lastRequested: null,
    requested: false,
    status: null,
    timesRequested: 0,
}) as EmptyRequestStatus;

/**
 * The client (User Agent) has closed the connection, e.g. due to CORS or going offline.
 */
export const failedRequest = (): FulfilledRequestStatus => Object.freeze({
    lastRequested: new Date(),
    requested: true,
    status: 499,
    timesRequested: 0,
}) as FulfilledRequestStatus;

const timedOutRequest = (totalRequested: number): FulfilledRequestStatus => Object.freeze({
    lastRequested: new Date(),
    requested: true,
    status: 408,
    timesRequested: totalRequested,
}) as FulfilledRequestStatus;

const queuedDeltaStatus = (totalRequested: number): FulfilledRequestStatus => Object.freeze({
    lastRequested: new Date(),
    requested: true,
    status: NON_AUTHORITATIVE_INFORMATION,
    timesRequested: totalRequested,
}) as FulfilledRequestStatus;

export class DataProcessor implements LinkedDataAPI, DeltaProcessor {
    public accept: { [k: string]: string };
    public timeout: number = 30000;

    private _fetcher: Fetcher | undefined;
    private _dispatch?: MiddlewareActionHandler;
    private readonly bulkEndpoint: string;
    private report: ErrorReporter;
    private deltas: Quadruple[][] = [];
    private readonly requestInitGenerator: RequestInitGenerator;
    private readonly mapping: { [k: string]: ResponseTransformer[] };
    private readonly requestMap: Map<number, Promise<Statement[]>>;
    private readonly statusMap: Array<EmptyRequestStatus | FulfilledRequestStatus | undefined>;
    private readonly store: RDFStore;

    private get fetcher(): Fetcher {
        if (typeof this._fetcher === "undefined") {
            this._fetcher = new Fetcher(this.store.getInternalStore(), {
                fetch: window && window.fetch.bind(window),
                timeout: this.timeout,
            });
            FETCHER_CALLBACKS.forEach((hook) => {
                const hookIRI = defaultNS.ll(`data/rdflib/${hook}`);
                this._fetcher!.addCallback(hook, this.invalidateCache.bind(this));
                this._fetcher!.addCallback(hook, (iri: string | NamedNode, _err?: Error) => {
                    this.dispatch(hookIRI, [typeof iri === "string" ? NamedNode.find(iri) : iri, _err]);

                    return true;
                });
            });
        }
        return this._fetcher;
    }

    private set fetcher(v: Fetcher) {
        this._fetcher = v;
    }

    public constructor(opts: DataProcessorOpts) {
        this.accept = opts.accept || {
            default: "",
        };
        this.bulkEndpoint = `${window.location.origin}/link-lib/bulk`;
        this._dispatch = opts.dispatch;
        this.requestInitGenerator = opts.requestInitGenerator || new RequestInitGenerator();
        this.mapping = opts.mapping || {};
        this.report = opts.report;
        this.requestMap = new Map();
        this.statusMap = [];
        this.store = opts.store;
        if (opts.fetcher) {
            this.fetcher = opts.fetcher;
        }
        this.processExecAction = this.processExecAction.bind(this);
        this.feedResponse = this.feedResponse.bind(this);
    }

    public get dispatch(): MiddlewareActionHandler {
        if (typeof this._dispatch === "undefined") {
            throw new Error("Invariant: cannot call `dispatch` before initialization is complete");
        }

        return this._dispatch;
    }

    public set dispatch(value: MiddlewareActionHandler) {
        this._dispatch = value;
    }

    public async execActionByIRI(subject: NamedNode, dataTuple: DataTuple): Promise<LinkedActionResponse> {

        const [graph, blobs = []] = dataTuple;

        await (this.store.statementsFor(subject).length > 0
            ? Promise.resolve([])
            : this.getEntity(subject));

        const object = this.store.getResourceProperty(subject, defaultNS.schema("object"));
        if (!object || object.termType !== "BlankNode" && object.termType !== "NamedNode") {
            throw new ProcessorError(MSG_OBJECT_NOT_IRI);
        }
        const target = this.store.getResourceProperty(subject, defaultNS.schema("target"));

        if (!target || target.termType === "Collection" || target.termType === "Literal") {
            throw new ProcessorError(MSG_INCORRECT_TARGET);
        }

        const urls = this.store.getResourceProperty(target, defaultNS.schema("url"));
        const url = Array.isArray(urls) ? urls[0] : urls;
        if (!url) {
            throw new ProcessorError(MSG_URL_UNDEFINED);
        }
        if (url.termType !== "NamedNode") {
            throw new ProcessorError(MSG_URL_UNRESOLVABLE);
        }
        const targetMethod = this.store.getResourceProperty(target, defaultNS.schema("httpMethod"));
        const method = typeof targetMethod !== "undefined" ? targetMethod.toString() : "GET";
        const opts = this.requestInitGenerator.generate(method, this.accept[new URL(url.value).origin]);

        if (opts.headers instanceof Headers) {
            opts.headers.set("Request-Referrer", subject.value);
        } else if (opts.headers && !Array.isArray(opts.headers)) {
            opts.headers["Request-Referrer"] = subject.value;
        }

        if (!SAFE_METHODS.includes(method) && graph && graph !== null && graph.length > 0) {
            if (opts.headers instanceof Headers) {
                opts.headers.delete("Content-Type");
            } else if (opts.headers && !Array.isArray(opts.headers)) {
                delete opts.headers["Content-Type"];
            }
            const data = new FormData();
            const s = new Serializer(new IndexedFormula());
            patchRDFLibSerializer(s, "deinprstux");
            s.setFlags("deinprstux");
            const rdfSerialization = s.statementsToNTriples(graph.statements);
            data.append(
                defaultNS.ll("graph").toString(),
                new Blob([rdfSerialization],
                    { type: F_NTRIPLES }),
            );
            for (let i = 0; i < blobs.length; i++) {
                data.append(blobs[i][0].toString(), blobs[i][1]);
            }
            opts.body = data;
        }

        const resp = await fetch(url.value, opts).then(this.processExecAction);

        if (resp.status > BAD_REQUEST) {
            // TODO: process responses with a correct content-type.
            throw new ProcessorError(MSG_BAD_REQUEST, resp);
        }

        const statements = await this.feedResponse(resp, true);

        const location = getHeader(resp, "Location");
        const fqLocation = location && Uri.join(location, window.location.origin);
        const iri = fqLocation && NamedNode.find(fqLocation) || null;

        return {
            data: statements,
            iri,
        };
    }

    public fetchableURLFromIRI(iri: NamedNode): NamedNode {
        return NamedNode.find(iri.value.split("#").shift()!);
    }

    public async fetchResource(iri: NamedNode | string, opts?: FetchOpts): Promise<ResponseAndFallbacks> {
        const iriString = typeof iri === "string" ? iri : iri.value;
        const accept = this.accept[new URL(iriString).origin] || this.accept.default;
        if (accept) {
            this.fetcher.mediatypes = {[accept]: {q: 1.0}};
        }

        const options = Object.assign (
            {},
            {
                credentials: "same-origin",
                headers: {
                    "Accept": accept,
                    "Content-Type": "application/n-quads",
                },
            },
            opts,
        );

        let res;
        try {
            res = await this.fetcher.load(iri, options);
        } catch (e) {
            if (typeof e.response !== "undefined") {
                res =  e.response;
            } else {
                throw e;
            }
        }

        return this.processExecAction(res);
    }

    public flush(): Statement[] {
        for (let i = 0; i < this.deltas.length; i++) {
            try {
                this.processDelta(this.deltas[i]);
            } catch (e) {
                this.report(e);
            }
        }
        this.deltas = [];

        return [];
    }

    public getEntities(resources: ResourceQueueItem[]): Promise<Statement[]> {
        const reload: NamedNode[] = [];
        const url = new URL(this.bulkEndpoint);
        for (let i = 0; i < resources.length; i++) {
            const resource = resources[i];
            if (resource[1] && resource[1].reload) {
                reload.push(resource[0]);
            }
            url.searchParams.append("resource", encodeURIComponent(resource[0].value));
        }
        const opts = this.requestInitGenerator.generate("GET", this.accept[url.origin]);

        return fetch(url.toString(), opts)
            .then(this.feedResponse)
            .catch((err) => {
                if (err instanceof Error) {
                    throw err;
                }

                const status = Literal.fromNumber(err.status);
                const delta = resources
                    .map(([s]) => [s, defaultNS.http("statusCode"), status, defaultNS.ll("meta")] as Quadruple);

                return this.processDelta(delta);
            });
    }

    /**
     * @see LinkedDataAPI#getEntity
     * @param iri The SomeNode of the entity
     * @param opts The options for fetch-/processing the resource.
     * @param opts The options for fetch-/processing the resource.
     * @return A promise with the resulting entity
     */
    public async getEntity(iri: NamedNode, opts?: FetchOpts): Promise<Statement[]> {
        const url = new URL(iri.value);
        url.hash = "";
        const requestIRI = NamedNode.find(url.toString());
        const existing = this.requestMap.get(requestIRI.sI);
        if (existing) {
            return existing;
        }

        let preExistingData: Statement[] = [];
        if (opts && opts.clearPreviousData) {
            preExistingData = this.store.statementsFor(iri);
            preExistingData = preExistingData.concat(this.store.statementsFor(requestIRI));
        }

        try {
            const req = this
                .fetchResource(requestIRI, opts)
                .then((res) => {
                    this.store.removeStatements(preExistingData);
                    return this.feedResponse(res);
                }); // TODO: feedResponse might only be necessary for non-rdflib fetcher requests.
            this.requestMap.set(requestIRI.sI, req);
            return await req;
        } catch (e) {
            if (typeof e.res === "undefined") {
                throw e;
            }
            this.store.removeStatements(preExistingData);
            const responseQuads = processResponse(iri, e.res);
            this.store.addStatements(responseQuads);

            return responseQuads;
        } finally {
            this.requestMap.delete(requestIRI.sI);
        }
    }

    /**
     * @see LinkedDataAPI#getStatus for documentation
     */
    public getStatus(iri: NamedNode): EmptyRequestStatus | FulfilledRequestStatus {
        const irl = this.fetchableURLFromIRI(iri);
        const existing = this.statusMap[irl.sI];

        if (existing) {
            return existing;
        }
        const fetcherStatus = this.fetcher.requested[irl.value];

        if (fetcherStatus === undefined) {
            if (irl.value in this.fetcher.requested) {
                return this.memoizeStatus(irl, failedRequest());
            }
            return this.memoizeStatus(irl, emptyRequest);
        }

        const requests = this.store.match(
            null,
            defaultNS.link("requestedURI"),
            Literal.find(irl.value),
        );
        const totalRequested = requests.length;
        if (requests.length === 0) {
            return this.memoizeStatus(irl, emptyRequest);
        }
        if (fetcherStatus === true) {
            return this.memoizeStatus(
                irl,
                {
                    lastRequested: new Date(),
                    lastResponseHeaders: null,
                    requested: true,
                    status: 202,
                    timesRequested: totalRequested,
                },
            );
        }
        if (fetcherStatus === "timeout") {
            return this.memoizeStatus(irl, timedOutRequest(totalRequested));
        }
        const requestIRI = requests.pop()!.subject as BlankNode;
        const requestObj = anyRDFValue(
            this.store.statementsFor(requestIRI),
            defaultNS.link("response"),
        ) as BlankNode | undefined;

        if (!requestObj) {
            return this.memoizeStatus(irl, emptyRequest);
        }

        const requestObjData = this.store.statementsFor(requestObj);

        // RDFLib has different behaviour across browsers and code-paths, so we must check for multiple properties.
        const requestStatus = anyRDFValue(requestObjData, defaultNS.http("status"))
            || anyRDFValue(requestObjData, defaultNS.http07("status"))
            || anyRDFValue(requestObjData, defaultNS.httph("status"));
        const requestDate = anyRDFValue(requestObjData, defaultNS.httph("date"));

        if (!requestStatus) {
            if (fetcherStatus === "done") {
                return this.memoizeStatus(irl, timedOutRequest(totalRequested));
            }
            return this.memoizeStatus(irl, emptyRequest);
        }

        return this.memoizeStatus(
            irl,
            {
                lastRequested: requestDate ? new Date(requestDate.value) : new Date(0),
                lastResponseHeaders: requestObj,
                requested: true,
                status: Number.parseInt(requestStatus.value, 10),
                timesRequested: totalRequested,
            },
        );
    }

    public processExternalResponse(response: Response): Promise<Statement[] | undefined> {
        return handleStatus(response)
            .then(this.feedResponse);
    }

    public processDelta(delta: Quadruple[]): Statement[] {
        let s: Quadruple;
        for (let i = 0, len = delta.length; i < len; i++) {
            s = delta[i];

            if (s[3] !== defaultNS.ll("meta")) {
                continue;
            }

            if (s[1] === defaultNS.http("statusCode")) {
                this.setStatus(s[0] as NamedNode, Number.parseInt(s[2].value, 10));
            }
        }

        return [];
    }

    /** Register a transformer so it can be used to interact with API's. */
    public registerTransformer(transformer: ResponseTransformer,
                               mediaType: string | string[],
                               acceptValue: number): void {
        const mediaTypes = Array.isArray(mediaType) ? mediaType : [mediaType];
        mediaTypes.forEach((type) => {
            pushToMap(this.mapping, type, transformer);
            this.accept.default = [this.accept.default, [type, acceptValue].join(";")].join();
        });
    }

    public queueDelta(delta: Quadruple[], subjects: number[]): void {
        this.deltas.push(delta);
        const status = queuedDeltaStatus(1);
        for (const s of subjects) {
            if (!this.statusMap[s]) {
                this.statusMap[s] = status;
            }
        }
    }

    public setAcceptForHost(origin: string, acceptValue: string): void {
        this.accept[new URL(origin).origin] = acceptValue;
    }

    private feedResponse(res: ResponseAndFallbacks, expedite: boolean = false): Promise<Statement[]> {
        if (res.status >= INTERNAL_SERVER_ERROR) {
            return Promise.reject(res);
        }
        const format = getContentType(res);
        const formatProcessors = this.mapping[format];
        const processor = formatProcessors && formatProcessors[0];

        if (processor === undefined) {
            return Promise.resolve([]);
        }

        (res as any).expedite = expedite;

        return processor(res);
    }

    private invalidateCache(iri: string | NamedNode, _err?: Error): boolean {
        this.statusMap[(typeof iri === "string" ? NamedNode.find(iri) : iri).sI] = undefined;

        return true;
    }

    private memoizeStatus(iri: NamedNode,
                          s: EmptyRequestStatus | FulfilledRequestStatus): EmptyRequestStatus | FulfilledRequestStatus {
        this.statusMap[iri.sI] = s;

        return s;
    }

    private processExecAction(res: Response): Promise<Response> {
        const actionsHeader = getHeader(res, "Exec-Action");
        if (actionsHeader) {
            const actions = actionsHeader.split(", ");
            for (let i = 0; i < actions.length; i++) {
                this.dispatch(NamedNode.find(actions[i]), undefined);
            }
        }

        return Promise.resolve(res);
    }

    private setStatus(iri: NamedNode, status: number): void {
        const url = this.fetchableURLFromIRI(iri);
        const prevStatus = this.statusMap[url.sI];
        this.store.touch(url);
        this.store.touch(iri);

        this.memoizeStatus(
            url,
            {
                lastRequested: new Date(),
                lastResponseHeaders: null,
                requested: true,
                status,
                timesRequested: prevStatus ? prevStatus.timesRequested + 1 : 1,
            },
        );
    }
}
