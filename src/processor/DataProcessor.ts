import rdfFactory, { Hextuple, isBlankNode, isLiteral, isNamedNode, QuadPosition, Resource } from "@ontologies/core";
import rdfx from "@ontologies/rdf";
import schema from "@ontologies/schema";
import xsd from "@ontologies/xsd";
import { site } from "@rdfdev/iri";
import {
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
} from "http-status-codes";

import { LinkedDataAPI } from "../LinkedDataAPI";
import link from "../ontology/link";
import ll from "../ontology/ll";
import {
    BlankNode,
    NamedNode,
} from "../rdf";
import {
    Fetcher,
    RDFFetchOpts,
} from "../rdflib";
import { RDFStore } from "../RDFStore";
import {
    DataProcessorOpts,
    DataTuple,
    DeltaProcessor,
    EmptyRequestStatus,
    ErrorReporter,
    FailedResponse,
    LinkedActionResponse,
    MiddlewareActionHandler,
    ResourceQueueItem,
    ResponseAndFallbacks,
    ResponseTransformer,
    SaveOpts,
    SomeNode,
    SomeRequestStatus,
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
import { getContentType, getHeader, getJSON, getURL } from "../utilities/responses";

import { ProcessorError } from "./ProcessorError";
import { RequestInitGenerator } from "./RequestInitGenerator";
import { failedRequest, queuedDeltaStatus, timedOutRequest } from "./requestStatus";

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
function processResponse(iri: string | NamedNode, res: Response): Hextuple[] {
    const rawURL = getURL(res);
    const origin = typeof iri === "string"
        ? rdfFactory.namedNode(new URL(rawURL).origin)
        : site(iri);

    if (rawURL && iri !== rawURL) {
        return [
            [
                iri,
                "http://www.w3.org/2002/07/owl#sameAs",
                rdfFactory.namedNode(rawURL),
                rdfx.ns("namedNode"),
                "",
                origin,
            ],
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

export const isRDFLibFetcher = (v: any): v is any => {
    return typeof v.appNode !== "undefined";
};

export class DataProcessor implements LinkedDataAPI, DeltaProcessor {
    public accept: { [k: string]: string };
    public timeout: number = 30000;

    private _fetcher?: Fetcher | undefined;
    private _dispatch?: MiddlewareActionHandler;
    private readonly bulkEndpoint: string;
    private report: ErrorReporter;
    private deltas: Hextuple[][] = [];
    private fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    private readonly invalidationMap: Map<Resource, void>;
    private readonly mapping: { [k: string]: ResponseTransformer[] };
    private readonly requestInitGenerator: RequestInitGenerator;
    private readonly requestMap: Map<Resource, Promise<Hextuple[]>>;
    private readonly statusMap: { [k: string]: SomeRequestStatus | undefined };
    private readonly store: RDFStore;

    private get fetcher(): Fetcher | undefined {
        return this._fetcher;
    }

    private set fetcher(v: Fetcher | undefined) {
        this._fetcher = v;

        if (isRDFLibFetcher(v)) {
            (v as any).fetch = typeof fetch !== "undefined"
                ? fetch
                : typeof window !== "undefined" && window.fetch.bind(window) || (v as any).fetch;
            (v as any).timeout = this.timeout;

            FETCHER_CALLBACKS.forEach((hook) => {
                const hookIRI = ll.ns(`data/rdflib/${hook}`);
                this._fetcher!.addCallback(hook, this.invalidate.bind(this));
                this._fetcher!.addCallback(hook, (iri: string | NamedNode | BlankNode, _err?: Error) => {
                    this.dispatch(hookIRI, [typeof iri === "string" ? rdfFactory.namedNode(iri) : iri, _err]);

                    return true;
                });
            });
        }
    }

    public constructor(opts: DataProcessorOpts) {
        this.accept = opts.accept || {
            default: "",
        };
        this.bulkEndpoint = `${typeof window !== "undefined" ? window.location.origin : ""}/link-lib/bulk`;
        this._dispatch = opts.dispatch;
        this.invalidationMap = new Map();
        this.requestInitGenerator = opts.requestInitGenerator || new RequestInitGenerator();
        this.mapping = opts.mapping || {};
        this.report = opts.report;
        this.requestMap = new Map();
        this.statusMap = {};
        this.store = opts.store;
        this.fetch = opts.fetch || (typeof window !== "undefined" && typeof fetch !== "undefined"
            ? fetch.bind(window)
            : (_: any, __: any): Promise<Response> => Promise.reject());
        if (opts.fetcher) {
            this.fetcher = opts.fetcher;
            if (!opts.fetch) {
                this.fetch = (url: RequestInfo, fetchOpts?: RequestInit): Promise<Response> => {
                    const iri = this.store.rdfFactory.namedNode(typeof url === "string" ? url : url.url);

                    return this.fetcher!.load(iri, fetchOpts as RDFFetchOpts);
                };
            }
        }
        if (opts.transformers) {
            opts.transformers.forEach((t) => this.registerTransformer(t.transformer, t.mediaType, t.acceptValue));
        }

        this.execExecHeader = this.execExecHeader.bind(this);
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

        if (this.store.quadsFor(subject).length === 0) {
            await this.getEntity(subject);
        }

        const object = this.store.getResourceProperty(subject, schema.object);
        if (!object || !isBlankNode(object) && !isNamedNode(object)) {
            throw new ProcessorError(MSG_OBJECT_NOT_IRI);
        }
        const target = this.store.getResourceProperty(subject, schema.target);

        if (!target || isLiteral(target)) {
            throw new ProcessorError(MSG_INCORRECT_TARGET);
        }

        const urls = this.store.getResourceProperty(target as SomeNode, schema.url);
        const url = Array.isArray(urls) ? urls[0] : urls;
        if (!url) {
            throw new ProcessorError(MSG_URL_UNDEFINED);
        }
        if (!isNamedNode(url)) {
            throw new ProcessorError(MSG_URL_UNRESOLVABLE);
        }
        const targetMethod = this.store.getResourceProperty(target as SomeNode, schema.httpMethod);
        const method = typeof targetMethod !== "undefined" ? targetMethod[0] : "GET";
        const opts = this.requestInitGenerator.generate(method, this.acceptForHost(url));

        if (opts.headers instanceof Headers) {
            opts.headers.set("Request-Referrer", subject);
        } else if (opts.headers && !Array.isArray(opts.headers)) {
            opts.headers["Request-Referrer"] = subject;
        }

        if (!SAFE_METHODS.includes(method) && graph && graph !== null && graph.length > 0) {
            if (opts.headers instanceof Headers) {
                opts.headers.delete("Content-Type");
            } else if (opts.headers && !Array.isArray(opts.headers)) {
                delete opts.headers["Content-Type"];
            }
            const data = new FormData();
            const rdfSerialization = this.serialize(graph.quads);
            data.append(
                ll.graph.toString(),
                new Blob([rdfSerialization],
                    { type: F_NTRIPLES }),
            );
            for (let i = 0; i < blobs.length; i++) {
                data.append(blobs[i][0].toString(), blobs[i][1]);
            }
            opts.body = data;
        }

        const resp = await this.fetch(url, opts).then(this.processExecAction);

        if (resp.status > BAD_REQUEST) {
            // TODO: process responses with a correct content-type.
            throw new ProcessorError(MSG_BAD_REQUEST, resp);
        }

        const statements = await this.feedResponse(resp, true);

        const location = getHeader(resp, "Location");
        const fqLocation = location && new URL(location || "", window.location.origin).toString();
        const iri = fqLocation && rdfFactory.namedNode(fqLocation) || null;

        return {
            data: statements,
            iri,
        };
    }

    public fetchableURLFromIRI(iri: NamedNode): NamedNode {
        if (iri.includes("#")) {
            return rdfFactory.namedNode(iri.split("#").shift()!);
        }

        return iri;
    }

    public flush(): Hextuple[] {
        const deltas = this.deltas;
        this.deltas = [];

        for (let i = 0; i < deltas.length; i++) {
            try {
                this.processDelta(deltas[i]);
            } catch (e) {
                this.report(e);
            }
        }

        return [];
    }

    public getEntities(resources: ResourceQueueItem[]): Promise<Hextuple[]> {
        const reload: NamedNode[] = [];

        const toBeFetched = new Set<NamedNode>();

        for (const resource of resources) {
            const id = resource[0];
            if (resource[1] && resource[1].reload) {
                reload.push(id);
            } else if (this.requestMap.has(id)) {
                continue;
            }
            toBeFetched.add(id);
        }

        if (toBeFetched.size === 0) {
            return Promise.resolve([]);
        }

        const body = new URLSearchParams();
        for (const entry of toBeFetched) {
            body.append("resource[]", encodeURIComponent(entry));
        }

        const opts = this.requestInitGenerator.generate("POST", this.acceptForHost(this.bulkEndpoint), body);
        const chain = this.fetch(this.bulkEndpoint, opts)
            .then(this.feedResponse)
            .catch((err) => {
                const status = rdfFactory.literal(err instanceof Error ? 499 : err.status, xsd.integer);
                const delta = resources
                    .map(([s]) => [s, defaultNS.http("statusCode"), ...status, ll.meta] as Hextuple);

                return this.processDelta(delta);
            }).finally(() => {
                toBeFetched.forEach((resource) => this.requestMap.delete(resource));
            });
        toBeFetched.forEach((resource) => {
            this.requestMap.set(resource, chain);
            this.setStatus(resource, null);
        });

        return chain;
    }

    /**
     * @see LinkedDataAPI#getEntity
     * @param iri The SomeNode of the entity
     * @param opts The options for fetch-/processing the resource.
     * @param opts The options for fetch-/processing the resource.
     * @return A promise with the resulting entity
     */
    public async getEntity(iri: NamedNode, opts?: RDFFetchOpts): Promise<Hextuple[]> {
        const url = new URL(iri);
        url.hash = "";
        const requestIRI = rdfFactory.namedNode(url.toString());
        const existing = this.requestMap.get(requestIRI.id);
        if (existing) {
            return existing;
        }

        let preExistingData: Hextuple[] = [];
        if (opts && opts.clearPreviousData) {
            preExistingData = this.store.quadsFor(iri);
            preExistingData = preExistingData.concat(this.store.quadsFor(requestIRI));
        }

        try {
            const reqOpts = this.requestInitGenerator.generate(
                "GET",
                this.acceptForHost(requestIRI),
            );
            const req = this.fetch(requestIRI.value, reqOpts)
                .then((response) => {
                    this.invalidate(iri);
                    this.setStatus(iri, response.status);

                    return response;
                })
                .then(this.feedResponse)
                .catch((err) => {
                    const status = rdfFactory.literal(err instanceof Error ? 499 : err.status, xsd.integer);
                    const delta: Hextuple[] = [
                        [requestIRI, defaultNS.http("statusCode"), ...status, ll.meta] as Hextuple,
                    ];
                    return this.processDelta(delta);
                });
            this.requestMap.set(requestIRI, req);
            return await req;
        } catch (e) {
            if (typeof e.res === "undefined") {
                throw e;
            }
            this.store.removeHexes(preExistingData);
            const responseQuads = processResponse(iri, e.res);
            this.store.addHextuples(responseQuads);

            return responseQuads;
        } finally {
            this.requestMap.delete(requestIRI);
        }
    }

    /**
     * @see LinkedDataAPI#getStatus for documentation
     */
    public getStatus(iri: NamedNode): SomeRequestStatus {
        const irl = this.fetchableURLFromIRI(iri);
        const existing = this.statusMap[irl];

        if (existing) {
            return existing;
        }
        const fetcherStatus = this.fetcher?.requested[irl];

        if (fetcherStatus === undefined) {
            if (this.fetcher && irl in this.fetcher.requested) {
                return this.memoizeStatus(irl, failedRequest());
            }
            return this.memoizeStatus(irl, emptyRequest);
        }

        const requests = this.store.match(
            null,
            link.requestedURI,
            rdfFactory.literal(irl),
            null,
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
            this.store.quadsFor(requestIRI),
            link.response,
        ) as BlankNode | undefined;

        if (!requestObj) {
            return this.memoizeStatus(irl, emptyRequest);
        }

        const requestObjData = this.store.quadsFor(requestObj);

        // RDFLib has different behaviour across browsers and code-paths, so we must check for multiple properties.
        const requestStatus = anyRDFValue(requestObjData, defaultNS.http("status"))
            || anyRDFValue(requestObjData, defaultNS.http07("status"))
            || anyRDFValue(requestObjData, defaultNS.httph("status"));
        const requestDate = anyRDFValue(requestObjData, defaultNS.httph("date"))?.[0];

        if (!requestStatus) {
            if (fetcherStatus === "done") {
                return this.memoizeStatus(irl, timedOutRequest(totalRequested));
            }
            return this.memoizeStatus(irl, emptyRequest);
        }

        return this.memoizeStatus(
            irl,
            {
                lastRequested: requestDate ? new Date(requestDate) : new Date(0),
                lastResponseHeaders: requestObj,
                requested: true,
                status: Number.parseInt(requestStatus[0], 10),
                timesRequested: totalRequested,
            },
        );
    }

    public invalidate(iri: string | SomeNode, _err?: Error): boolean {
        this.invalidationMap.set(iri);
        // TODO: Don't just remove, but rather mark it as invalidated so it's history isn't lost.
        this.statusMap[iri] = undefined;

        return true;
    }

    public isInvalid(iri: SomeNode): boolean {
        return this.invalidationMap.has(iri);
    }

    public processExternalResponse(response: Response): Promise<Hextuple[] | undefined> {
        return handleStatus(response)
            .then(this.feedResponse);
    }

    public processDelta(delta: Array<Hextuple|void>): Hextuple[] {
        let s: Hextuple|void;
        for (let i = 0, len = delta.length; i < len; i++) {
            s = delta[i];
            const subj = s ? s[0] : undefined;

            const currentStatus = subj && this.statusMap[subj];
            if (subj && currentStatus && currentStatus.status === 203) {
                this.statusMap[subj] = undefined;
            }

            if (!s || s[QuadPosition.graph] !== ll.meta) {
                continue;
            }

            if (s[1] === defaultNS.http("statusCode")) {
                this.removeInvalidation(subj as NamedNode);
                this.setStatus(subj as NamedNode, Number.parseInt(s[2], 10));
            } else if (s[1] === defaultNS.httph("Exec-Action")) {
                this.execExecHeader(s[2]);
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

    public save(iri: SomeNode, opts: SaveOpts = { useDefaultGraph: true }): Promise<void> {
        if (isBlankNode(iri) && !opts?.url) {
            throw new Error("Can't resolve");
        }

        const target = isBlankNode(iri) ? opts.url! : (opts?.url || iri);
        const targetData = opts.data || !opts?.useDefaultGraph
            ? this.store.matchHex(null, null, null, null, null, iri)
            : this.store.matchHex(iri, null, null, null, null, this.store.rdfFactory.defaultGraph());

        const options = this.requestInitGenerator.generate(
            opts.method || "PUT",
            this.acceptForHost(target),
            this.serialize(targetData),
        );

        return this.fetch(target, options)
            .then(() => Promise.resolve());
    }

    public queueDelta(delta: Hextuple[], subjects: string[]): void {
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

    private acceptForHost(iri: NamedNode | string): string {
        return this.accept[new URL(iri).origin]
            || this.accept.default;
    }

    private execExecHeader(actionsHeader: string | null | undefined, args?: any): void {
        if (actionsHeader) {
            const actions = actionsHeader.split(", ");
            for (let i = 0; i < actions.length; i++) {
                this.dispatch(rdfFactory.namedNode(actions[i]), args);
            }
        }
    }

    private feedResponse(res: ResponseAndFallbacks, expedite: boolean = false): Promise<Hextuple[]> {
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

    private memoizeStatus(iri: NamedNode, s: SomeRequestStatus): SomeRequestStatus {
        this.statusMap[iri] = s;

        return s;
    }

    private processExecAction(res: Response): Promise<Response> {
        const actionsHeader = getHeader(res, "Exec-Action");
        this.execExecHeader(actionsHeader);

        return Promise.resolve(res);
    }

    private removeInvalidation(subject: NamedNode): void {
        this.invalidationMap.delete(subject);
    }

    private serialize(data: Hextuple[]): string {
        return data.reduce((acc, quad) => acc.concat(rdfFactory.toNQ(quad)), "");
    }

    private setStatus(iri: NamedNode, status: number | null): void {
        const url = this.fetchableURLFromIRI(iri);
        const prevStatus = this.statusMap[url];
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
