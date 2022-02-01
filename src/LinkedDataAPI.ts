import { NamedNode, Quadruple } from "@ontologies/core";

import {
    DataTuple,
    DeltaProcessor,
    Dispatcher,
    EmptyRequestStatus,
    FulfilledRequestStatus,
    LinkedActionResponse,
    PendingRequestStatus,
    ResourceQueueItem,
    ResponseTransformer,
    SomeNode,
} from "./types";

export interface APIFetchOpts {
    clearPreviousData?: boolean;
    force?: boolean;
}

export interface LinkedDataAPI extends Dispatcher, DeltaProcessor {

    execActionByIRI(subject: SomeNode, dataTuple: DataTuple): Promise<LinkedActionResponse>;

    /** @private */
    getEntities(resources: ResourceQueueItem[]): Promise<Quadruple[]>;

    /**
     * Gets an entity by its SomeNode.
     *
     * When data is already present for the SomeNode as a subject, the stored data is returned,
     * otherwise the SomeNode will be fetched and processed.
     * @param iri The SomeNode of the resource
     * @param opts The options for fetch-/processing the resource.
     * @return A promise with the resulting entity
     */
    getEntity(iri: NamedNode, opts?: APIFetchOpts): Promise<Quadruple[]>;

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
     * Overrides the `Accept` value for when a certain host doesn't respond well to multiple values.
     * @param origin The iri of the origin for the requests.
     * @param acceptValue The value to use for the `Accept` header.
     */
    setAcceptForHost(origin: string, acceptValue: string): void;
}
