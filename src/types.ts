import {
  BlankNode,
  CustomPredicateCreator,
  Literal,
  LowLevelStore,
  NamedNode,
  Node,
  Quad,
  Quadruple,
  SomeTerm,
} from "@ontologies/core";

import { ComponentStore } from "./ComponentStore";
import { LinkedDataAPI } from "./LinkedDataAPI";
import { LinkedRenderStore } from "./LinkedRenderStore";
import { DataProcessor } from "./processor/DataProcessor";
import { RequestInitGenerator } from "./processor/RequestInitGenerator";
import { Fetcher } from "./rdflib";
import { RDFStore } from "./RDFStore";
import { Schema } from "./Schema";
import RDFIndex from "./store/RDFIndex";
import { DisjointSet } from "./utilities/DisjointSet";

export interface ActionMap {
    [k: string]: (...args: any[]) => Promise<any>;
}

export type SubscriptionCallback<T> = (v: T, lastUpdateAt?: number) => void;

export type Indexable = number | string;

export interface IdTerm {
    id?: Indexable;
}

export interface ComponentMapping<T> { [type: string]: { [obj: string]: { [topology: string]: T } }; }

export interface SubscriptionRegistrationBase<T> {
    callback: SubscriptionCallback<T>;
    index?: number;
    lastUpdateAt?: number;
    markedForDelete: boolean;
    onlySubjects: boolean;
    subjectFilter?: SomeNode[];
    subscribedAt?: number;
}

export interface StatementSubscriptionRegistration extends SubscriptionRegistrationBase<ReadonlyArray<Quad>> {
    onlySubjects: false;
}

export interface NodeSubscriptionRegistration extends SubscriptionRegistrationBase<SomeNode[]> {
    onlySubjects: true;
}

export type SubscriptionRegistration = StatementSubscriptionRegistration | NodeSubscriptionRegistration;

export interface ComponentRegistration<T> {
    component: T;
    property: Indexable;
    topology: Indexable;
    type: Indexable;
}

export type ResponseTransformer = (response: ResponseAndFallbacks) => Promise<Quad[]>;

export interface ErrorResponse {
    errors?: Array<{ message: string }>;
}

export interface FailedResponse {
    message: string;
    res: Response | undefined;
}

export type ErrorReporter = (e: Error, ...args: any) => void;

export interface FetchOpts {
    /** Force-reload the resource discarding any previously held data. */
    reload: boolean;
}

export type SomeNode = NamedNode | BlankNode;

export interface LinkedRenderStoreOptions<T, API extends LinkedDataAPI = DataProcessor> {
    api?: API | undefined;
    apiOpts?: Partial<DataProcessorOpts> | undefined;
    defaultType?: NamedNode | undefined;
    dispatch?: MiddlewareActionHandler;
    mapping?: ComponentStore<T> | undefined;
    namespaces?: NamespaceMap | undefined;
    report?: ErrorReporter;
    schema?: Schema | undefined;
    store?: RDFStore | undefined;
}

export interface DeltaProcessor {
    queueDelta: (delta: Quadruple[], subjects: number[]) => void;
    /**
     * Process all queued deltas
     * @note: Be sure to assign a new buffer array before starting processing to prevent infinite loops.
     */
    flush: () => Quad[];
    processDelta: (delta: Quadruple[]) => Quad[];
}

export type StoreProcessorResult = [Quadruple[], Quadruple[], Quad[]];
export type StoreProcessor = (delta: Quadruple[]) => StoreProcessorResult;

export interface Dispatcher {
    dispatch: MiddlewareActionHandler;
}

export type MiddlewareFn<T, API extends LinkedDataAPI = DataProcessor> = (store: LinkedRenderStore<T, API>) =>
  MiddlewareWithBoundLRS;

export type MiddlewareWithBoundLRS = (next: MiddlewareActionHandler) => MiddlewareActionHandler;

export type MiddlewareActionHandler = (action: NamedNode, args: any) => Promise<any>;

export interface NamespaceMap {
    [k: string]: CustomPredicateCreator;
}

export type LazyNNArgument = NamedNode | NamedNode[];

export type LazyIRIArgument = SomeNode | SomeNode[];

export type NamedBlobTuple = [SomeNode, File];

export type SerializablePrimitives = boolean | DataObject | Date | File | number | string
    | NamedNode | BlankNode | Literal;

export type SerializableDataTypes = SerializablePrimitives | SerializablePrimitives[];

export interface DataObject {
    [k: string]: SerializableDataTypes;
}

export type DataTuple = [RDFIndex, NamedBlobTuple[]];
export type ParsedObject = [SomeNode, LowLevelStore, NamedBlobTuple[]];

export interface ChangeBuffer {
    changeBuffer: Quad[];
    changeBufferCount: number;
}

export interface LinkedActionResponse {
    /** The IRI of the created resource, based from the Location header. */
    iri: NamedNode | null;
    data: Quad[];
}

export interface SaveOpts extends RequestInit {
    data?: Quad[];
    url?: NamedNode;
    useDefaultGraph?: boolean;
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

export interface GetEntityMessage {
    method: "GET_ENTITY";
    params: {
        iri: string;
    };
}

export interface VocabularyProcessingContext<IndexType = Indexable> {
    dataStore: RDFStore;
    equivalenceSet: DisjointSet<IndexType>;
    superMap: Map<IndexType, Set<IndexType>>;
    store: Schema<any>;
}

export interface VocabularyProcessor {
    axioms: Quad[];

    processStatement: (item: Quad, ctx: VocabularyProcessingContext<any>) => Quad[] | null;

    /**
     * Processes class instances (object to rdf:type). If an IRI is given, processors must assume the resource to be an
     * instance of rdfs:Class.
     */
    processType: (type: NamedNode, ctx: VocabularyProcessingContext<any>) => boolean;
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
    fetcher?: Fetcher;
    mapping?: { [k: string]: ResponseTransformer[] };
    transformers?: TransformerRegistrationRequest[];
    report: ErrorReporter;
    store: RDFStore;
}

export type ResourceQueueItem = [NamedNode, FetchOpts|undefined];

export type WildQuadruple = [Node | null, NamedNode | null, SomeTerm | null, Node | null];
