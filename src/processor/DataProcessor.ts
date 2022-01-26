import rdfFactory, { isBlankNode, NamedNode, QuadPosition, Quadruple, TermType } from "@ontologies/core";
import * as schema from "@ontologies/schema";
import * as xsd from "@ontologies/xsd";
import { site } from "@rdfdev/iri";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, NON_AUTHORITATIVE_INFORMATION, NOT_FOUND } from "http-status-codes";
import { equals, id } from "../factoryHelpers";

import { APIFetchOpts, LinkedDataAPI } from "../LinkedDataAPI";
import http from "../ontology/http";
import httph from "../ontology/httph";
import ll from "../ontology/ll";
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
    RequestStatus,
    ResourceQueueItem,
    ResponseAndFallbacks,
    ResponseTransformer,
    SaveOpts,
    SomeNode,
    SomeRequestStatus,
} from "../types";
import { doc } from "../utilities";
import {
    F_NTRIPLES,
    MSG_BAD_REQUEST,
    MSG_INCORRECT_TARGET,
    MSG_URL_UNDEFINED,
    MSG_URL_UNRESOLVABLE,
} from "../utilities/constants";
import { getContentType, getHeader, getJSON, getURL } from "../utilities/responses";

import { RecordState } from "../store/RecordState";
import { ProcessorError } from "./ProcessorError";
import { RequestInitGenerator } from "./RequestInitGenerator";
import { queuedDeltaStatus } from "./requestStatus";

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
function processResponse(iri: string | NamedNode, res: Response): Quadruple[] {
    const rawURL = getURL(res);
    const origin = typeof iri === "string"
        ? rdfFactory.namedNode(new URL(rawURL).origin)
        : site(iri);

    if (rawURL && iri !== rawURL) {
        return [
            [
                typeof iri === "string" ? rdfFactory.namedNode(iri) : iri,
                rdfFactory.namedNode("http://www.w3.org/2002/07/owl#sameAs"),
                rdfFactory.namedNode(rawURL),
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

export class DataProcessor implements LinkedDataAPI, DeltaProcessor {
    public accept: { [k: string]: string };

    private _dispatch?: MiddlewareActionHandler;
    private readonly bulkEndpoint: string;
    private report: ErrorReporter;
    private deltas: Quadruple[][] = [];
    private fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    private readonly invalidationMap: Map<number, void>;
    private readonly mapping: { [k: string]: ResponseTransformer[] };
    private readonly requestInitGenerator: RequestInitGenerator;
    private readonly requestMap: Map<number, Promise<Quadruple[]>>;
    private readonly statusMap: { [k: string]: SomeRequestStatus | undefined };
    private readonly store: RDFStore;

    public constructor(opts: DataProcessorOpts) {
        this.accept = opts.accept || {
            default: "",
        };
        this.bulkEndpoint = opts.bulkEndpoint || `${typeof window !== "undefined" ? window.location.origin : ""}/link-lib/bulk`;
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

        if (this.store.getInternalStore().store.getRecord(subject.value) === undefined) {
            await this.getEntity(subject);
        }

        const target = this.store.getResourceProperty(subject, schema.target);

        if (!target || target.termType === "Collection" || target.termType === TermType.Literal) {
            throw new ProcessorError(MSG_INCORRECT_TARGET);
        }

        const urls = this.store.getResourceProperty(target as SomeNode, schema.url);
        const url = Array.isArray(urls) ? urls[0] : urls;
        if (!url) {
            throw new ProcessorError(MSG_URL_UNDEFINED);
        }
        if (url.termType !== TermType.NamedNode) {
            throw new ProcessorError(MSG_URL_UNRESOLVABLE);
        }
        const targetMethod = this.store.getResourceProperty(target as SomeNode, schema.httpMethod);
        const method = typeof targetMethod !== "undefined" ? targetMethod.value : "GET";
        const opts = this.requestInitGenerator.generate(method, this.acceptForHost(url));

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

        const resp = await this.fetch(url.value, opts).then(this.processExecAction);

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

    public flush(): Quadruple[] {
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

    public getEntities(resources: ResourceQueueItem[]): Promise<Quadruple[]> {
        const reload: NamedNode[] = [];

        const toBeFetched = new Set<NamedNode>();

        for (const [iri, fetchOpts] of resources) {
            const rId = id(iri);
            if (fetchOpts && fetchOpts.reload) {
                reload.push(iri);
            } else if (this.requestMap.has(rId)) {
                continue;
            }
            toBeFetched.add(iri);
        }

        if (toBeFetched.size === 0) {
            return Promise.resolve([]);
        }

        const body = new URLSearchParams();
        for (const entry of toBeFetched) {
            body.append("resource[]", encodeURIComponent(entry.value));
        }

        const opts = this.requestInitGenerator.generate("POST", this.acceptForHost(this.bulkEndpoint), body);
        const chain = this.fetch(this.bulkEndpoint, opts)
            .then(this.feedResponse)
            .catch((err) => {
                const hasStatus = err && "status" in err;
                this.report(err);
                const status = rdfFactory.literal(hasStatus ? err.status : 499, xsd.integer);
                const delta = resources
                    .map(([s]) => {
                        this.setStatus(s, status);
                        return [s, http.statusCode, status, ll.meta] as Quadruple;
                    });

                return this.processDelta(delta);
            }).finally(() => {
                toBeFetched.forEach((resource) => this.requestMap.delete(id(resource)));
            });
        toBeFetched.forEach((resource) => {
            this.requestMap.set(id(resource), chain);
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
    public async getEntity(iri: NamedNode, opts?: APIFetchOpts): Promise<Quadruple[]> {
        const url = new URL(iri.value);
        url.hash = "";
        const requestIRI = rdfFactory.namedNode(url.toString());
        const existing = this.requestMap.get(requestIRI.id);
        if (existing) {
            return existing;
        }

        let preExistingData: Quadruple[] = [];
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
                    this.setStatus(iri, response.status);

                    return response;
                })
                .then(this.feedResponse)
                .catch((err) => {
                    this.report(err);
                    const hasStatus = err && "status" in err;
                    const status = rdfFactory.literal(hasStatus ? err.status : 499, xsd.integer);
                    this.setStatus(iri, status);
                    const delta: Quadruple[] = [
                        [requestIRI, http.statusCode, status, ll.meta],
                    ];
                    return this.processDelta(delta);
                });
            this.requestMap.set(id(requestIRI), req);
            return await req;
        } catch (e) {
            if (typeof (e as any).res === "undefined") {
                throw e;
            }
            this.store.removeQuads(preExistingData);
            const responseQuads = processResponse(iri, (e as any).res);
            this.setStatus(iri, 499);
            this.store.addQuads(responseQuads);

            return responseQuads;
        } finally {
            this.requestMap.delete(id(requestIRI));
        }
    }

    /**
     * @see LinkedDataAPI#getStatus for documentation
     */
    public getStatus(iri: NamedNode): SomeRequestStatus {
        const irl = doc(iri);
        const existing = this.statusMap[id(irl)];

        if (existing) {
            return existing;
        }

        return emptyRequest;
    }

    public invalidate(iri: string | SomeNode, _err?: Error): boolean {
        const iriId = id(typeof iri === "string" ? rdfFactory.namedNode(iri) : iri);
        this.invalidationMap.set(iriId);
        // TODO: Don't just remove, but rather mark it as invalidated so it's history isn't lost.
        this.clearStatus(typeof iri === "string" ? rdfFactory.namedNode(iri) : iri);

        return true;
    }

    public isInvalid(iri: SomeNode): boolean {
        return this.invalidationMap.has(id(iri));
    }

    public processExternalResponse(response: Response): Promise<Quadruple[] | undefined> {
        return handleStatus(response)
            .then(this.feedResponse);
    }

    public processDelta(delta: Array<Quadruple|void>): Quadruple[] {
        let s: Quadruple|void;
        for (let i = 0, len = delta.length; i < len; i++) {
            s = delta[i];
            const subj = s ? s[0] : undefined;

            const currentStatus = subj && this.statusMap[id(subj)];
            if (subj && currentStatus && currentStatus.status === NON_AUTHORITATIVE_INFORMATION) {
                this.clearStatus(subj as NamedNode);
            }

            if (!s || !equals(s[QuadPosition.graph], ll.meta)) {
                continue;
            }

            if (equals(s[1], http.statusCode)) {
                this.removeInvalidation(subj as NamedNode);
                this.setStatus(subj as NamedNode, Number.parseInt(s[2].value, 10));
            } else if (equals(s[1], httph["Exec-Action"])) {
                this.execExecHeader(s[2].value);
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

        const target = isBlankNode(iri) ? opts.url! : (opts?.url ?? iri);
        const targetData = this.store.match(null, null, null);

        const options = this.requestInitGenerator.generate(
            opts.method || "PUT",
            this.acceptForHost(target),
            this.serialize(targetData),
        );

        return this.fetch(target.value, options)
            .then(() => Promise.resolve());
    }

    public queueDelta(delta: Quadruple[], subjects: number[]): void {
        this.deltas.push(delta);
        const status = queuedDeltaStatus(1);
        for (const s of subjects) {
            if (!this.statusMap[s]) {
                this.memoizeStatus(rdfFactory.fromId(s), status);
            }
        }
    }

    public setAcceptForHost(origin: string, acceptValue: string): void {
        this.accept[new URL(origin).origin] = acceptValue;
    }

    private acceptForHost(iri: NamedNode | string): string {
        return this.accept[new URL(typeof iri === "string" ? iri : iri.value).origin]
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

    private feedResponse(res: ResponseAndFallbacks, expedite: boolean = false): Promise<Quadruple[]> {
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
        this.store.getInternalStore().store.journal.transition(iri.value, this.requestStatusToJournalStatus(s));
        this.statusMap[id(iri)] = s;

        return s;
    }

    private clearStatus(iri: NamedNode): void {
        this.statusMap[id(iri)] = undefined;
    }

    private requestStatusToJournalStatus(s: RequestStatus): RecordState {
        if (s.requested && s.status === null) {
            return RecordState.Requested;
        } else if (s.requested) {
            return RecordState.Present;
        } else if (!s.requested && s.status === null) {
            return RecordState.Absent;
        } else {
            throw new Error(`Unmapped status ${s}`);
        }
    }

    private processExecAction(res: Response): Promise<Response> {
        const actionsHeader = getHeader(res, "Exec-Action");
        this.execExecHeader(actionsHeader);

        return Promise.resolve(res);
    }

    private removeInvalidation(subject: NamedNode): void {
        this.invalidationMap.delete(id(subject));
    }

    private serialize(data: Quadruple[]): string {
        return data.reduce((acc, qdr) => acc.concat(rdfFactory.toNQ(rdfFactory.quad(
            qdr[QuadPosition.subject],
            qdr[QuadPosition.predicate],
            qdr[QuadPosition.object],
            qdr[QuadPosition.graph],
        ))), "");
    }

    private setStatus(iri: NamedNode, status: number | null): void {
        const url = doc(iri);
        const prevStatus = this.statusMap[id(url)];

        this.memoizeStatus(
            url,
            {
                lastRequested: new Date(),
                lastResponseHeaders: null,
                requested: true,
                status,
                subject: iri,
                timesRequested: prevStatus ? prevStatus.timesRequested + 1 : 1,
            },
        );
    }
}
