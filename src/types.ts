import {
    BlankNode,
    CustomPredicateCreator,
    Literal,
    NamedNode,
    Quadruple, SomeTerm,
} from "@ontologies/core";

import { ComponentStore } from "./ComponentStore/ComponentStore";
import { LinkedDataAPI } from "./LinkedDataAPI";
import { LinkedRenderStore } from "./LinkedRenderStore";
import { DataProcessor } from "./processor/DataProcessor";
import { RequestInitGenerator } from "./processor/RequestInitGenerator";
import { RDFStore } from "./RDFStore";
import { Schema } from "./Schema";
import RDFIndex from "./store/RDFIndex";
import { DataRecord, Id } from "./store/types";
import { DisjointSet } from "./utilities/DisjointSet";

export type SubscriptionCallback<T> = (v: T, lastUpdateAt?: number) => void;

export type Indexable = number | string;

export interface ComponentMapping<T> {
    /** The registration type, either a field identifier or the TYPE_RENDER_CLASS identifier */
    [type: string]: {
        /** The type of the object */
        [klass: string]: {
            [topology: string]: T,
        },
    };
}

export interface SubscriptionRegistrationBase<T> {
    callback: SubscriptionCallback<T>;
    index?: number;
    lastUpdateAt?: number;
    markedForDelete: boolean;
    subjectFilter?: string[];
    subscribedAt?: number;
}

export interface ComponentRegistration<T> {
    component: T;
    property: Id;
    topology: Id;
    type: Id;
}

export type ResponseTransformer = (response: ResponseAndFallbacks) => Promise<Quadruple[]>;

export interface ErrorResponse {
    errors?: Array<{ message: string }>;
}

export interface FailedResponse {
    message: string;
    res: Response | undefined;
}

export type ErrorReporter = (e: unknown, ...args: any) => void;

export interface FetchOpts {
    /** Force-reload the resource discarding any previously held data. */
    reload: boolean;
}

export type SomeNode = NamedNode | BlankNode;

export interface LinkedRenderStoreOptions<T, API extends LinkedDataAPI = DataProcessor> {
    api?: API | undefined;
    apiOpts?: Partial<DataProcessorOpts> | undefined;
    data?: Record<Id, DataRecord>;
    defaultType?: NamedNode | undefined;
    dispatch?: MiddlewareActionHandler;
    mapping?: ComponentStore<T> | undefined;
    namespaces?: NamespaceMap | undefined;
    rehydration?: {} | undefined;
    report?: ErrorReporter;
    schema?: Schema | undefined;
    store?: RDFStore | undefined;
}

export interface DeltaProcessor {
    queueDelta: (delta: Quadruple[]) => void;
    /**
     * Process all queued deltas
     * @note: Be sure to assign a new buffer array before starting processing to prevent infinite loops.
     */
    flush: () => Set<string>;
    processDelta: (delta: Quadruple[]) => void;
}

export type StoreProcessorResult = [Quadruple[], Quadruple[], Quadruple[]];
export type StoreProcessor = (delta: Quadruple[]) => StoreProcessorResult;

export interface Dispatcher {
    dispatch: MiddlewareActionHandler;
}

export type MiddlewareFn<T, API extends LinkedDataAPI = DataProcessor> = (store: LinkedRenderStore<T, API>) =>
  MiddlewareWithBoundLRS;

export type MiddlewareWithBoundLRS = (next: MiddlewareActionHandler) => MiddlewareActionHandler;

export type MiddlewareActionHandler = (action: SomeNode, args?: any) => Promise<any>;

export interface NamespaceMap {
    [k: string]: CustomPredicateCreator;
}

export type LazyNNArgument = NamedNode | NamedNode[];

export type NamedBlobTuple = [SomeNode, File];

export type SerializablePrimitives = boolean | DataObject | Date | File | number | string
    | NamedNode | BlankNode | Literal;

export type SerializableDataTypes = SerializablePrimitives | SerializablePrimitives[];

export interface DataObject {
    [k: string]: SerializableDataTypes;
}

export type DataTuple = [RDFIndex, NamedBlobTuple[]];
export type ParsedObject = [SomeNode, RDFIndex, NamedBlobTuple[]];

export interface ChangeBuffer {
    changeBuffer: Quadruple[];
    changeBufferCount: number;
}

export interface LinkedActionResponse {
    /** The IRI of the created resource, based from the Location header. */
    iri: NamedNode | null;
    data: Quadruple[];
}

export interface ExtensionResponse {
    body: string;
    headers: { [k: string]: string };
    status: number;
    url: string;
}

export interface RDFLibFetcherResponse extends Response {
    responseText: string;
    req: BlankNode;
}

export interface RDFLibFetcherRequest {
    body: string;
    headers: { [k: string]: string };
    requestedURI: string;
    status: number;
}

export interface RequestStatus {
    lastRequested: Date | null;
    requested: boolean;
    status: number | null;
    subject: NamedNode;
    timesRequested: number;
}

export interface EmptyRequestStatus extends RequestStatus {
    lastRequested: null;
    requested: false;
    status: null;
    timesRequested: 0;
}

export interface PendingRequestStatus extends RequestStatus {
    lastRequested: Date;
    lastResponseHeaders: null;
    requested: true;
    status: null;
    timesRequested: number;
}

export interface FulfilledRequestStatus extends RequestStatus {
    lastRequested: Date;
    lastResponseHeaders: BlankNode | null;
    requested: true;
    status: number;
}

export type SomeRequestStatus = EmptyRequestStatus | PendingRequestStatus | FulfilledRequestStatus;

export type ResponseAndFallbacks = Response
    | XMLHttpRequest
    | ExtensionResponse
    | RDFLibFetcherRequest
    | RDFLibFetcherResponse;

export interface WorkerMessageBase {
    method: string;
    params: object;
}

export interface VocabularyProcessingContext<IndexType = Indexable> {
    dataStore: RDFStore;
    equivalenceSet: DisjointSet<IndexType>;
    superMap: Map<IndexType, Set<IndexType>>;
    store: Schema;
}

export interface VocabularyProcessor {
    axioms: Quadruple[];

    processStatement: (
        recordId: Id,
        field: Id,
        value: SomeTerm,
        ctx: VocabularyProcessingContext<any>,
    ) => void;

    /**
     * Processes class instances (object to rdf:type). If an IRI is given, processors must assume the resource to be an
     * instance of rdfs:Class.
     */
    processType: (type: string, ctx: VocabularyProcessingContext<any>) => boolean;
}

export interface TransformerRegistrationRequest {
    acceptValue: number;
    mediaType: string | string[];
    transformer: ResponseTransformer;
}

export interface DataProcessorOpts {
    accept?: { [k: string]: string };
    bulkEndpoint?: string;
    dispatch?: MiddlewareActionHandler;
    requestInitGenerator?: RequestInitGenerator;
    fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
    mapping?: { [k: string]: ResponseTransformer[] };
    transformers?: TransformerRegistrationRequest[];
    report: ErrorReporter;
    store: RDFStore;
}

export type ResourceQueueItem = [NamedNode, FetchOpts|undefined];
