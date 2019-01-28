import { Quadruple } from "n-quads-parser";
import {
    BlankNode,
    Fetcher,
    IndexedFormula,
    Literal,
    NamedNamespace,
    NamedNode,
    Statement,
} from "rdflib";

import { ComponentStore } from "./ComponentStore";
import { LinkedDataAPI } from "./LinkedDataAPI";
import { LinkedRenderStore } from "./LinkedRenderStore";
import { RequestInitGenerator } from "./processor/RequestInitGenerator";
import { RDFStore } from "./RDFStore";
import { Schema } from "./Schema";
import { DisjointSet } from "./utilities/DisjointSet";

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

export interface StatementSubscriptionRegistration extends SubscriptionRegistrationBase<ReadonlyArray<Statement>> {
    onlySubjects: false;
}

export interface NodeSubscriptionRegistration extends SubscriptionRegistrationBase<SomeNode[]> {
    onlySubjects: true;
}

export type SubscriptionRegistration = StatementSubscriptionRegistration | NodeSubscriptionRegistration;

export interface ComponentRegistration<T> {
    component: T;
    property: number;
    topology: number;
    type: number;
}

export type ResponseTransformer = (response: ResponseAndFallbacks) => Promise<Statement[]>;

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

export interface LinkedRenderStoreOptions<T> {
    api?: LinkedDataAPI | undefined;
    defaultType?: NamedNode | undefined;
    dispatch?: MiddlewareActionHandler;
    mapping?: ComponentStore<T> | undefined;
    namespaces?: NamespaceMap | undefined;
    report: ErrorReporter;
    schema?: Schema | undefined;
    store?: RDFStore | undefined;
}

export interface DeltaProcessor {
    queueDelta: (delta: Quadruple[]) => void;
    flush: () => Statement[];
    processDelta: (delta: Quadruple[]) => Statement[];
}

export interface Dispatcher {
    dispatch: MiddlewareActionHandler;
}

export type MiddlewareFn<T> = (store: LinkedRenderStore<T>) => MiddlewareWithBoundLRS;

export type MiddlewareWithBoundLRS = (next: MiddlewareActionHandler) => MiddlewareActionHandler;

export type MiddlewareActionHandler = (action: NamedNode, args: any) => Promise<any>;

export interface NamespaceMap {
    [s: string]: NamedNamespace;
}

export type LazyNNArgument = NamedNode | NamedNode[];

export type LazyIRIArgument = SomeNode | SomeNode[];

export type NamedBlobTuple = [SomeNode, File];

export type SerializablePrimitives = boolean | DataObject | Date | File | number | string | NamedNode | Literal;

export type SerializableDataTypes = SerializablePrimitives | SerializablePrimitives[];

export interface DataObject {
    [k: string]: SerializableDataTypes;
}

export type DataTuple = [IndexedFormula, NamedBlobTuple[]];

export interface ChangeBuffer {
    changeBuffer: Statement[];
    changeBufferCount: number;
}

export interface LinkedActionResponse {
    /** The IRI of the created resource, based from the Location header. */
    iri: NamedNode | null;
    data: Statement[];
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

export interface VocabularyProcessingContext {
    equivalenceSet: DisjointSet<number>;
    superMap: Map<number, Set<number>>;
    store: IndexedFormula;
}

export interface VocabularyProcessor {
    axioms: Statement[];

    processStatement: (item: Statement, ctx: VocabularyProcessingContext) => Statement[] | null;

    /**
     * Processes class instances (object to rdf:type). If an IRI is given, processors must assume the resource to be an
     * instance of rdfs:Class.
     */
    processType: (type: NamedNode, ctx: VocabularyProcessingContext) => boolean;
}

export interface DataProcessorOpts {
    accept?: { [k: string]: string };
    dispatch?: MiddlewareActionHandler;
    requestInitGenerator?: RequestInitGenerator;
    fetcher?: Fetcher;
    mapping?: { [k: string]: ResponseTransformer[] };
    report: ErrorReporter;
    store: RDFStore;
}

export type ResourceQueueItem = [NamedNode, FetchOpts|undefined];
