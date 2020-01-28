import { Hextuple, NamedNode } from "@ontologies/core";

import { RDFFetchOpts } from "./rdflib";
import {
    DataProcessorOpts,
    DeltaProcessor,
    Dispatcher,
    PendingRequestStatus,
    ResourceQueueItem,
    SaveOpts,
} from "./types";
import {
    DataTuple,
    EmptyRequestStatus,
    FulfilledRequestStatus,
    LinkedActionResponse,
    ResponseTransformer,
    SomeNode,
} from "./types";

export interface LinkedDataAPI extends Dispatcher, DeltaProcessor {

    execActionByIRI(subject: NamedNode, dataTuple: DataTuple): Promise<LinkedActionResponse>;

    /** @private */
    getEntities(resources: ResourceQueueItem[]): Promise<Hextuple[]>;

    /**
     * Gets an entity by its SomeNode.
     *
     * When data is already present for the SomeNode as a subject, the stored data is returned,
     * otherwise the SomeNode will be fetched and processed.
     * @param iri The SomeNode of the resource
     * @param opts The options for fetch-/processing the resource.
     * @return A promise with the resulting entity
     */
    getEntity(iri: NamedNode, opts?: RDFFetchOpts): Promise<Hextuple[]>;

    /**
     * Retrieve the (network) status for a resource.
     *
     * This API is still unstable, but only the latest status should be taken into account. So if a resource was
     * successfully fetched at some point, but a retry failed, the result will be failed.
     *
     * Some cases don't have proper HTTP status codes, but some (unstandardized) codes are very close.
     *
     * Special errors:
     * - Resources which are still loading are given status `202 Accepted`.
     * - Resources where fetching timed out are given status `408 - Request Timeout`.
     * - Resources where fetching failed due to browser and OS errors are given status `499 - Client Closed Request`.
     * - Resources which haven't been requested and aren't scheduled to be requested currently have no status code.
     *
     * @param iri The resource to get the status on.
     */
    getStatus(iri: SomeNode): EmptyRequestStatus | PendingRequestStatus | FulfilledRequestStatus;

    /** @unstable */
    invalidate(iri: string | SomeNode, error?: Error): boolean;

    /** @unstable */
    isInvalid(iri: SomeNode): boolean;

    /** Register a transformer so it can be used to interact with API's. */
    registerTransformer(processor: ResponseTransformer,
                        mediaType: string | string[],
                        acceptValue: number): void;

    /**
     * Save a {graph} to {graph} (identity) or {opts.url}.
     *
     * When {graph} is a blank node {opts.url} must be given as well.
     *
     * @param graph
     * @param opts
     * @param {Hextuple[]} opts.data - Override default data collection for this data.
     * @param {string} opts.url - Overrides the target to save the resource to.
     * @param {boolean} opts.useDefaultGraph - Changes data collection to search for {graph} in the default graph rather
     *  than the named graph {graph}.
     */
    save(graph: SomeNode, opts: SaveOpts): Promise<void>;

    /**
     * Overrides the `Accept` value for when a certain host doesn't respond well to multiple values.
     * @param origin The iri of the origin for the requests.
     * @param acceptValue The value to use for the `Accept` header.
     */
    setAcceptForHost(origin: string, acceptValue: string): void;
}

declare var LinkedDataAPI: {
    new (opts?: DataProcessorOpts): any;
    (): any;
};
