import {
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
} from "http-status-codes";
import {
    BlankNode,
    Fetcher,
    FetchOpts,
    IndexedFormula,
    Literal,
    NamedNode,
    RequestCallbackHandler,
    Serializer,
    Statement,
    uri as Uri,
} from "rdflib";

import { RDFStore } from "../RDFStore";
import {
    DataTuple,
    EmptyRequestStatus,
    FailedResponse,
    FulfilledRequestStatus,
    LinkedActionResponse,
    ResponseAndFallbacks,
    ResponseTransformer,
} from "../types";
import { anyRDFValue } from "../utilities";
import {
    defaultNS,
    MSG_BAD_REQUEST,
    MSG_INCORRECT_TARGET,
    MSG_OBJECT_NOT_IRI,
    MSG_URL_UNDEFINED,
    MSG_URL_UNRESOLVABLE,
} from "../utilities/constants";
import { namedNodeByIRI } from "../utilities/memoizedNamespace";
import {
    getContentType,
    getHeader,
    getJSON,
    getURL,
} from "../utilities/responses";

import { ProcessorError } from "./ProcessorError";
import { RequestInitGenerator } from "./RequestInitGenerator";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS", "CONNECT", "TRACE"];

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
    const origin = iri instanceof NamedNode ? iri.site() : new URL(rawURL).origin;
    if (rawURL && iri !== rawURL) {
        return [
            new Statement(
                new NamedNode(iri),
                new NamedNode("http://www.w3.org/2002/07/owl#sameAs"),
                new NamedNode(rawURL),
                origin,
            ),
        ];
    }

    return [];
}

export interface DataProcessorOpts {
    accept?: { [k: string]: string };
    requestInitGenerator?: RequestInitGenerator;
    fetcher?: Fetcher;
    mapping?: { [k: string]: ResponseTransformer[] };
    requestNotifier?: RequestCallbackHandler;
    store: RDFStore;
}

export const emptyRequest = Object.freeze({
    lastRequested: null,
    requested: false,
    status: null,
    timesRequested: 0,
});

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

export class DataProcessor {
    public accept: { [k: string]: string };
    public timeout: number = 30000;

    private _fetcher: Fetcher | undefined;
    private readonly requestInitGenerator: RequestInitGenerator;
    private readonly mapping: { [k: string]: ResponseTransformer[] };
    private readonly requestMap: Map<NamedNode, Promise<Statement[]> | undefined>;
    private readonly requestNotifier?: RequestCallbackHandler;
    private readonly store: RDFStore;

    private get fetcher(): Fetcher {
        if (typeof this._fetcher === "undefined") {
            this._fetcher = new Fetcher(this.store.getInternalStore(), {
                fetch: window && window.fetch.bind(window),
                timeout: this.timeout,
            });
            if (typeof this.requestNotifier !== "undefined") {
                ["done", "fail", "refresh", "request", "retract"].forEach((hook) => {
                    this._fetcher!.addCallback(hook, this.requestNotifier!);
                });
            }
        }
        return this._fetcher;
    }

    private set fetcher(v: Fetcher) {
        this._fetcher = v;
    }

    public constructor(opts: DataProcessorOpts = {} as DataProcessorOpts) {
        this.accept = opts.accept || {
            default: "",
        };
        this.requestInitGenerator = opts.requestInitGenerator || new RequestInitGenerator();
        this.mapping = opts.mapping || {};
        this.requestMap = new Map();
        this.store = opts.store;
        this.requestNotifier = opts.requestNotifier;
        if (opts.fetcher) {
            this.fetcher = opts.fetcher;
        }
    }

    public async execActionByIRI(subject: NamedNode, dataTuple: DataTuple): Promise<LinkedActionResponse> {

        const [graph, blobs = []] = dataTuple;

        await this.store.statementsFor(subject).length > 0 ? Promise.resolve() : this.getEntity(subject);

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

        if (!SAFE_METHODS.includes(method) && graph && graph !== null && graph.length > 0) {
            if (opts.headers instanceof Headers) {
                opts.headers.delete("Content-Type");
            } else if (opts.headers && !Array.isArray(opts.headers)) {
                delete opts.headers["Content-Type"];
            }
            const data = new FormData();
            const s = new Serializer(new IndexedFormula());
            const rdfSerialization = s.toN3(graph);
            data.append(
                defaultNS.ll("graph").toString(),
                new Blob([rdfSerialization],
                    { type: "text/n3" }),
            );
            blobs.forEach(([blobIRI, blob]) => {
                data.append(blobIRI.toString(), blob);
            });
            opts.body = data;
        }

        const resp = await fetch(url.value, opts);

        if (resp.status > BAD_REQUEST) {
            // TODO: process responses with a correct content-type.
            throw new ProcessorError(MSG_BAD_REQUEST, resp);
        }

        const statements = await this.feedResponse(resp);

        const location = getHeader(resp, "Location");
        const fqLocation = location && Uri.join(location, window.location.origin);
        const iri = fqLocation && namedNodeByIRI(fqLocation) || null;

        return {
            data: statements,
            iri,
        };
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

        return this.fetcher.load(iri, options);
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
        const requestIRI = new NamedNode(url.toString());
        if (this.requestMap.has(requestIRI)) {
            return this.requestMap.get(requestIRI) || [];
        }

        try {
            const req = this
                .fetchResource(requestIRI, opts)
                .then((res) => this.feedResponse(res)); // TODO: feedResponse is only necessary for external requests.
            this.requestMap.set(requestIRI, req);
            return await req;
        } catch (e) {
            if (typeof e.res === "undefined") {
                throw e;
            }
            const responseQuads = processResponse(iri, e.res);
            this.store.addStatements(responseQuads);

            return responseQuads;
        } finally {
            this.requestMap.delete(requestIRI);
        }
    }

    /**
     * @see LinkedDataAPI#getStatus for documentation
     */
    public getStatus(iri: NamedNode): EmptyRequestStatus | FulfilledRequestStatus {
        const irl = namedNodeByIRI(iri.value.split("#").shift()!);
        const fetcherStatus = this.fetcher.requested[irl.value];

        if (fetcherStatus === undefined) {
            if (irl.value in this.fetcher.requested) {
                return failedRequest();
            }
            return emptyRequest as EmptyRequestStatus;
        }

        const requests = this.store.match(
            null,
            defaultNS.link("requestedURI"),
            new Literal(irl.value),
        );
        const totalRequested = requests.length;
        if (requests.length === 0) {
            return emptyRequest as EmptyRequestStatus;
        }
        if (fetcherStatus === true) {
            return {
                lastRequested: new Date(),
                requested: true,
                status: 202,
                timesRequested: totalRequested,
            };
        }
        if (fetcherStatus === "timeout") {
            return timedOutRequest(totalRequested);
        }
        const requestIRI = requests.pop()!.subject as BlankNode;
        const requestObj = anyRDFValue(
            this.store.statementsFor(requestIRI),
            defaultNS.link("response"),
        );

        if (!requestObj) {
            return emptyRequest as EmptyRequestStatus;
        }

        const requestObjData = this.store.statementsFor(requestObj as BlankNode);

        // RDFLib has different behaviour across browsers and code-paths, so we must check for multiple properties.
        const requestStatus = anyRDFValue(requestObjData, defaultNS.http("status"))
            || anyRDFValue(requestObjData, defaultNS.http07("status"))
            || anyRDFValue(requestObjData, defaultNS.httph("status"));
        const requestDate = anyRDFValue(requestObjData, defaultNS.httph("date"));

        if (!requestStatus) {
            if (fetcherStatus === "done") {
                return timedOutRequest(totalRequested);
            }
            return emptyRequest as EmptyRequestStatus;
        }

        return {
            lastRequested: requestDate ? new Date(requestDate.value) : new Date(0),
            requested: true,
            status: Number.parseInt(requestStatus.value, 10),
            timesRequested: totalRequested,
        };
    }

    public processExternalResponse(response: Response): Promise<Statement[] | undefined> {
        return handleStatus(response)
            .then((res) => this.feedResponse(res));
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

    public setAcceptForHost(origin: string, acceptValue: string): void {
        this.accept[new URL(origin).origin] = acceptValue;
    }

    private feedResponse(res: ResponseAndFallbacks): Promise<Statement[]> {
        const format = getContentType(res);
        const formatProcessors = this.mapping[format];
        const processor = formatProcessors && formatProcessors[0];

        if (processor === undefined) {
            return Promise.resolve([]);
        }

        return processor(res);
    }
}
