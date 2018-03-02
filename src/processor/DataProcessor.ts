import {
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
} from "http-status-codes";
import {
    Fetcher,
    FetchOpts,
    NamedNode,
    Statement,
} from "rdflib";
import { RDFStore } from "../RDFStore";

import {
    FailedResponse,
    ResponseAndFallbacks,
    ResponseTransformer,
} from "../types";
import {
    fetchWithExtension,
    getExtention,
    isDifferentOrigin,
} from "../utilities";
import {
    getContentType,
    getHeader,
    getJSON,
    getURL,
} from "../utilities/responses";

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
    fetcher?: Fetcher;
    mapping?: { [k: string]: ResponseTransformer[] };
    store: RDFStore;
}

export class DataProcessor {
    public accept: { [k: string]: string };
    public timeout: number = 30000;

    private _fetcher: Fetcher | undefined;
    private mapping: { [k: string]: ResponseTransformer[] };
    private requestMap: { [k: string]: Promise<Statement[]> | undefined };
    private store: RDFStore;

    private get fetcher(): Fetcher {
        if (typeof this._fetcher === "undefined") {
            this._fetcher = new Fetcher(this.store.getInternalStore(), {timeout: this.timeout});
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
        this.mapping = opts.mapping || {};
        this.requestMap = {};
        this.store = opts.store;
        if (opts.fetcher) {
            this.fetcher = opts.fetcher;
        }
    }

    public async fetchResource(iri: NamedNode, opts?: FetchOpts): Promise<ResponseAndFallbacks> {
        const iriString = typeof iri === "string" ? iri : iri.value;
        const accept = this.accept[new URL(iriString).origin] || this.accept.default;
        if (isDifferentOrigin(iri) && getExtention()) {
            return fetchWithExtension(iri, accept);
        }
        if (accept) {
            this.fetcher.mediatypes = {[accept]: {q: 1.0}};
        }

        const options = Object.assign (
            {},
            {
                credentials: "same-origin",
                headers: {
                    "Accept": accept,
                    "Content-Type": "application/vnd.api+json",
                },
            },
            opts,
        );

        return this.fetcher.fetch(iri, options);
    }

    /**
     *
     * @param iri The SomeNode of the entity
     * @param opts The options for fetch-/processing the resource.
     * @param opts The options for fetch-/processing the resource.
     * @return A promise with the resulting entity
     */
    public async getEntity(iri: NamedNode, opts?: FetchOpts): Promise<Statement[]> {
        const url = new URL(iri.value);
        url.hash = "";
        const requestIRI = new NamedNode(url.toString());
        if (typeof this.requestMap[requestIRI.toString()] !== "undefined") {
            return this.requestMap[requestIRI.toString()] || [];
        }

        try {
            return this.requestMap[requestIRI.toString()] = this
                .fetchResource(requestIRI, opts)
                .then((res) => this.feedResponse(res)); // TODO: feedResponse is only necessary for external requests.
        } catch (e) {
            if (typeof e.res === "undefined") {
                throw e;
            }
            const responseQuads = processResponse(iri, e.res);
            this.store.addStatements(responseQuads);

            return responseQuads;
        } finally {
            this.requestMap[requestIRI.toString()] = undefined;
        }
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
        if (format === "") {
            return Promise.resolve([]);
        }
        const processor = this.mapping[format][0];

        return processor(res);
    }
}
