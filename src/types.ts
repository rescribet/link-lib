import {
    Fetcher,
    IndexedFormula,
    NamedNamespace,
} from "rdflib";

import { ComponentStore } from "./ComponentStore";
import { LinkedDataAPI } from "./LinkedDataAPI";
import { LinkedRenderStore } from "./LinkedRenderStore";
import { RequestInitGenerator } from "./processor/RequestInitGenerator";
import {
    BlankNode,
    Literal,
    NamedNode,
    Quad,
    Quadruple,
    RDFObjectBase,
} from "./rdf";
import { RDFStore } from "./RDFStore";
import { Schema } from "./Schema";
import { DisjointSet } from "./utilities/DisjointSet";

export interface ActionMap {
    [k: string]: (...args: any[]) => void|Promise<any>;
}

export type SubscriptionCallback<T> = (v: T, lastUpdateAt?: number) => void;

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
    property: NamedNode;
    topology: NamedNode;
    type: NamedNode;
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

export type SomeNode<T = RDFObjectBase> = NamedNode<T> | BlankNode<T>;

export interface LinkedRenderStoreOptions<RDFObject extends RDFObjectBase> {
    api?: LinkedDataAPI | undefined;
    defaultType?: NamedNode | undefined;
    dispatch?: MiddlewareActionHandler;
    mapping?: ComponentStore<RDFObject> | undefined;
    namespaces?: NamespaceMap | undefined;
    report?: ErrorReporter;
    schema?: Schema | undefined;
    store?: RDFStore<RDFObject> | undefined;
}

export interface DeltaProcessor<RDFBase> {
    queueDelta: (delta: Array<Quadruple<RDFBase>>, subjects: number[]) => void;
    /**
     * Process all queued deltas
     * @note: Be sure to assign a new buffer array before starting processing to prevent infinite loops.
     */
    flush: () => Array<Quad<RDFBase>>;
    processDelta: (delta: Array<Quadruple<RDFBase>>) => Array<Quad<RDFBase>>;
}

export type StoreProcessorResult<RDFBase> = [
    Array<Quadruple<RDFBase>>,
    Array<Quadruple<RDFBase>>,
    Array<Quad<RDFBase>>
];
export type StoreProcessor<RDFBase> = (delta: Array<Quadruple<RDFBase>>) => StoreProcessorResult<RDFBase>;

export interface Dispatcher<RDFBase> {
    dispatch: MiddlewareActionHandler<RDFBase>;
}

export type MiddlewareFn<T, RDFBase> = (store: LinkedRenderStore<T>) => MiddlewareWithBoundLRS<RDFBase>;

export type MiddlewareWithBoundLRS<RDFBase> = (next: MiddlewareActionHandler<RDFBase>) => MiddlewareActionHandler<RDFBase>;

export type MiddlewareActionHandler<RDFBase> = (action: NamedNode<RDFBase>, args: any) => Promise<any>;

export interface NamespaceMap {
    [s: string]: NamedNamespace<any>;
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

export type DataTuple<T = RDFObjectBase> = [IndexedFormula<T>, NamedBlobTuple[]];
export type ParsedObject<T = RDFObjectBase> = [Node, IndexedFormula<T>, NamedBlobTuple[]];

export interface ChangeBuffer {
    changeBuffer: Quad[];
    changeBufferCount: number;
}

export interface LinkedActionResponse<T extends RDFObjectBase> {
    /** The IRI of the created resource, based from the Location header. */
    iri: NamedNode<T> | null;
    data: Quad[];
}

export interface ExtensionResponse {
    body: string;
    headers: { [k: string]: string };
    status: number;
    url: string;
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
    timesRequested: number;
}

export interface EmptyRequestStatus extends RequestStatus {
    lastRequested: null;
    requested: false;
    status: null;
    timesRequested: 0;
}

export interface FulfilledRequestStatus extends RequestStatus {
    lastRequested: Date;
    lastResponseHeaders: BlankNode | null;
    requested: true;
    status: number;
}

export type ResponseAndFallbacks = Response | XMLHttpRequest | ExtensionResponse | RDFLibFetcherRequest;

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

export interface VocabularyProcessingContext<RDFBase = RDFObjectBase> {
    equivalenceSet: DisjointSet<number>;
    superMap: Map<number, Set<number>>;
    store: IndexedFormula<RDFBase>;
}

export interface VocabularyProcessor<RDFBase = RDFObjectBase> {
    axioms: Quad[];

    processStatement: (item: Quad, ctx: VocabularyProcessingContext<RDFBase>) => Quad[] | null;

    /**
     * Processes class instances (object to rdf:type). If an IRI is given, processors must assume the resource to be an
     * instance of rdfs:Class.
     */
    processType: (type: NamedNode, ctx: VocabularyProcessingContext<RDFBase>) => boolean;
}

export interface DataProcessorOpts<RDFBase extends RDFObjectBase> {
    accept?: { [k: string]: string };
    dispatch?: MiddlewareActionHandler;
    requestInitGenerator?: RequestInitGenerator;
    fetcher?: Fetcher<RDFBase>;
    mapping?: { [k: string]: ResponseTransformer[] };
    report: ErrorReporter;
    store: RDFStore<RDFBase>;
}

export type ResourceQueueItem = [NamedNode, FetchOpts|undefined];
