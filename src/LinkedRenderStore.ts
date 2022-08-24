import rdfFactory, {
    isNode,
    isQuad,
    NamedNode,
    Node,
    Quad,
    QuadPosition,
    Quadruple,
    SomeTerm,
    Term,
    TermType,
} from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as schema from "@ontologies/schema";

import { ComponentStore } from "./ComponentStore/ComponentStore";
import { equals, value } from "./factoryHelpers";
import { APIFetchOpts, LinkedDataAPI } from "./LinkedDataAPI";
import { ProcessBroadcast } from "./ProcessBroadcast";
import { DataProcessor, emptyRequest } from "./processor/DataProcessor";
import { dataToGraphTuple } from "./processor/DataToGraph";
import { RDFStore } from "./RDFStore";
import { Schema } from "./Schema";
import { RecordState } from "./store/RecordState";
import { RecordStatus } from "./store/RecordStatus";
import { DataRecord, DeepRecord, Id } from "./store/types";
import { TypedRecord } from "./TypedRecord";
import {
    ComponentRegistration,
    DataObject,
    DeltaProcessor,
    Dispatcher,
    EmptyRequestStatus,
    ErrorReporter,
    FetchOpts,
    LazyNNArgument,
    LinkedActionResponse,
    LinkedRenderStoreOptions,
    MiddlewareActionHandler,
    NamespaceMap,
    ResourceQueueItem,
    SomeNode,
    SomeRequestStatus,
    SubscriptionRegistrationBase,
} from "./types";
import { normalizeType } from "./utilities";
import { DEFAULT_TOPOLOGY, RENDER_CLASS_NAME } from "./utilities/constants";

const normalizedIds = <
    T extends SomeTerm | SomeTerm[] | Array<SomeTerm | undefined> | undefined,
    K extends (T extends undefined ? SomeTerm : SomeTerm | undefined),
>(item: T, defaultValue?: K): string[] => normalizeType(item)
    .map((t) => (t ?? defaultValue)!.value);

/**
 * Main entrypoint into the functionality of link-lib.
 *
 * Before using the methods for querying data and views here, search through your render library (e.g. link-redux) to
 * see if it exposes an API which covers your use-case. Skipping the render library might cause unexpected behaviour and
 * hard to solve bugs.
 */
export class LinkedRenderStore<T, API extends LinkedDataAPI = DataProcessor> implements Dispatcher {
    public static registerRenderer<T>(
        component: T,
        type: LazyNNArgument,
        prop: LazyNNArgument = RENDER_CLASS_NAME,
        topology: LazyNNArgument | Array<NamedNode | undefined> = DEFAULT_TOPOLOGY): Array<ComponentRegistration<T>> {

        const types = normalizedIds(type);
        const props = normalizedIds(prop, RENDER_CLASS_NAME);
        const topologies = normalizedIds(topology, DEFAULT_TOPOLOGY);

        return ComponentStore.registerRenderer(component, types, props, topologies);
    }

    /**
     * Map of {ActionMap} which hold action dispatchers. Calling a dispatcher should execute the action, causing them to
     * be handled like any back-end sent action.
     *
     * Constructing action IRI's and dispatching them in user code was a bit hard, this object allows any middleware to
     * define their actions (within their namespace) in a code-oriented fashion. The middleware has control over how the
     * actions will be dispatched, but it should be the same as if a back-end would have executed the action (via the
     * Exec-Action header).
     */
    public actions: TypedRecord = new TypedRecord();
    /** Whenever a resource has no type, assume it to be this. */
    public defaultType: NamedNode = schema.Thing;
    public deltaProcessors: DeltaProcessor[];
    public report: ErrorReporter;
    /**
     * Can aid in parsing and creating prefix mapping strings.
     * @deprecated Please use @ontologies/<namespace> packages in your programs, canonicalizing certain
     *   prefixes will lead to brittle and hard to refactor code!
     */
    public namespaces: NamespaceMap = {};

    public api: API;
    public mapping: ComponentStore<T>;
    public schema: Schema;
    public store: RDFStore;
    public settings: TypedRecord = new TypedRecord();

    /**
     * Enable the bulk api to fetch data with.
     */
    public bulkFetch: boolean = false;

    private _dispatch?: MiddlewareActionHandler;
    private cleanupTimout: number = 500;
    private cleanupTimer: number | undefined;
    private currentBroadcast: Promise<void> | undefined;
    private broadcastHandle: number | undefined;
    private bulkSubscriptions: Array<SubscriptionRegistrationBase<unknown>> = [];
    private subjectSubscriptions: { [k: string]: Array<SubscriptionRegistrationBase<unknown>> } = {};
    private lastPostponed: number | undefined;
    private resourceQueueFlushTimer: number = 100;
    private resourceQueue: ResourceQueueItem[];
    private resourceQueueHandle: number | undefined;

    // tslint:disable-next-line no-object-literal-type-assertion
    public constructor(opts: LinkedRenderStoreOptions<T, API> = {}) {
        if (opts.store) {
            this.store = opts.store;
        } else {
            this.store = new RDFStore({ data: opts.data });
        }

        this.report = opts.report || ((e): void => { throw e; });
        this.api = opts.api || new DataProcessor({
            ...opts.apiOpts,
            dispatch: opts.dispatch,
            report: this.report,
            store: this.store,
        }) as unknown as API;
        this.deltaProcessors = [this.api, this.store];
        if (opts.dispatch) {
            this.dispatch = opts.dispatch;
        }
        this.defaultType = opts.defaultType || schema.Thing;
        this.namespaces = opts.namespaces || {};
        this.schema = opts.schema || new Schema(this.store);
        this.mapping = opts.mapping || new ComponentStore(this.schema);
        this.resourceQueue = [];

        this.broadcast = this.broadcast.bind(this);
        this.processResourceQueue = this.processResourceQueue.bind(this);
    }

    public get dispatch(): MiddlewareActionHandler {
        if (typeof this._dispatch === "undefined") {
            throw new Error("Invariant: cannot call `dispatch` before initialization is complete, see createStore");
        }

        return this._dispatch;
    }

    public set dispatch(v: MiddlewareActionHandler) {
        this._dispatch = v;
        this.api.dispatch = v;
    }

    /**
     * Add a custom delta processor in the stack.
     */
    public addDeltaProcessor(processor: DeltaProcessor): void {
        this.deltaProcessors.unshift(processor);
    }

    /**
     * Execute an Action by its IRI. This will result in an HTTP request being done and probably some state changes.
     * @param subject The resource to execute. Generally a schema:Action derivative with a
     *   schema:EntryPoint to describe the request. Currently schema:url is used over schema:urlTemplate
     *   to acquire the request URL, since template processing isn't implemented (yet).
     * @param data An object to send in the body when a non-safe method is used.
     */
    public execActionByIRI(subject: SomeNode, data?: DataObject): Promise<LinkedActionResponse> {
        const preparedData = dataToGraphTuple(data || {}, this.namespaces);
        return this
            .api
            .execActionByIRI(subject, preparedData)
            .then((res: LinkedActionResponse) => {
                this.broadcast(false, 100);
                return res;
            });
    }

    /**
     * Execute a resource.
     *
     * Every action will fall through the execution middleware layers.
     *
     * @see https://github.com/rescribet/link-lib/wiki/%5BDesign-draft%5D-Actions,-data-streams,-and-middleware
     *
     * @param subject The resource to execute (can be either an IRI or an URI)
     * @param args The arguments to the function defined by the subject.
     */
    public async exec(subject: SomeNode, args?: DataObject): Promise<any> {
        return this.dispatch(subject, args);
    }

    /**
     * Resolve the values at the end of the path
     * @param subject The resource to start descending on
     * @param path A list of linked predicates to descend on.
     */
    public dig(subject: Node | undefined, path: NamedNode[]): SomeTerm[] {
        const [result] = this.digDeeper(subject, path);

        return result.map((q) => q[QuadPosition.object]);
    }

    /**
     * @internal See {dig}
     * @param subject
     * @param path
     * @param subject - The subject traversed.
     */
    public digDeeper(subject: Node | undefined, path: Array<NamedNode | NamedNode[]>): [Quadruple[], SomeNode[]] {
        if (path.length === 0 || typeof subject === "undefined") {
            return [[], []];
        }

        const last = path.length - 1;
        let ids: Node[] = [subject];
        const intermediates: Node[] = [subject];
        const values: Quadruple[] = [];
        for (let i = 0; i <= last; i++) {
            const field = path[i];
            const segmentIds = ids;
            ids = [];

            for (let j = 0; j < segmentIds.length; j++) {
                const id = segmentIds[j];
                const quads = this.getResourcePropertyRaw(id, field);

                if (i === last) {
                    values.push(...quads);
                    continue;
                }

                const next = quads
                  .map((q) => q[QuadPosition.object] as Node)
                  .filter((v) => isNode(v));
                intermediates.push(...next);
                ids.push(...next);
            }
        }

        return [values, intermediates];
    }

    /**
     * Retrieve the subjects from {subject} to find all resources which have an object at the
     * end of the {path} which matches {match}.
     * @param subject The resource to start descending on.
     * @param path A list of linked predicates to descend on.
     * @param match The value which the predicate at the end of {path} has to match for its subject to return.
     */
    public findSubject(subject: Node | undefined, path: NamedNode[], match: Term | Term[]): Node[] {
        if (path.length === 0 || typeof subject === "undefined") {
            return [];
        }

        const remaining = path.slice();
        const pred = remaining.shift();
        const props = this.getResourceProperties(subject, pred!);

        if (props.length === 0) {
            return [];
        }

        if (remaining.length === 0) {
            const finder = Array.isArray(match)
                ? (p: Term): boolean => match.some((m) => equals(m, p))
                : (p: Term): boolean => equals(match, p);

            return props.find(finder) ? [subject] : [];
        }

        return props
            .map((term) => (term.termType === TermType.NamedNode || term.termType === TermType.BlankNode)
                && this.findSubject(term as Node, remaining, match))
            .flat(1)
            .filter<Node>(Boolean as any);
    }

    /**
     * Finds the best render component for a given property in respect to a topology.
     *
     * @renderlibrary This should only be used by render-libraries, not by application code.
     * @param type The type(s) of the resource to render.
     * @param predicate The predicate(s) (property(s)) to render.
     * @param [topology] The topology of the resource, if any
     * @returns The most appropriate renderer, if any.
     */
    public getComponentForProperty(type: NamedNode | NamedNode[] | undefined = this.defaultType,
                                   predicate: NamedNode | NamedNode[],
                                   topology: NamedNode = DEFAULT_TOPOLOGY): T | null | undefined {
        if (type === undefined || (Array.isArray(type) && type.length === 0)) {
            return undefined;
        }
        const types = normalizeType(type).map(value);
        const predicates = normalizeType(predicate).map(value);

        return this.mapping.getRenderComponent(
            types,
            predicates,
            value(topology),
            value(this.defaultType),
        );
    }

    /**
     * Finds the best render component for a type in respect to a topology.
     *
     * @renderlibrary This should only be used by render-libraries, not by application code.
     * @see LinkedRenderStore#getComponentForProperty
     * @param type The type(s) of the resource to render.
     * @param [topology] The topology of the resource, if any
     * @returns The most appropriate renderer, if any.
     */
    public getComponentForType(
        type: NamedNode | NamedNode[],
        topology: NamedNode = DEFAULT_TOPOLOGY,
    ): T | null | undefined {
        return this.getComponentForProperty(type, RENDER_CLASS_NAME, topology);
    }

    /**
     * Efficiently queues a resource to be fetched later.
     *
     * This skips the overhead of creating a promise and allows the subsystem to retrieve multiple resource in one
     * round trip, sacrificing loading status for performance.
     * @renderlibrary This should only be used by render-libraries, not by application code.
     */
    public queueEntity(iri: NamedNode, opts?: FetchOpts): void {
        if (!(opts && opts.reload) && !this.shouldLoadResource(iri)) {
            return;
        }

        this.store.getInternalStore().store.transition(iri.value, RecordState.Queued);
        this.resourceQueue.push([iri, opts]);
        this.scheduleResourceQueue();
    }

    /**
     * Queue a linked-delta to be processed.
     *
     * Note: This should only be used by render-libraries (e.g. link-redux), not by application code.
     * @renderlibrary This should only be used by render-libraries, not by application code.
     */
    public queueDelta(delta: Array<Quadruple|void> | Quad[], expedite = false): Promise<void> {
        const quadArr = isQuad(delta[0])
            ? (delta as Quad[]).map((s: Quad) => rdfFactory.qdrFromQuad(s))
            : delta as Quadruple[];

        for (const dp of this.deltaProcessors) {
            dp.queueDelta(quadArr);
        }

        return this.broadcastWithExpedite(expedite);
    }

    /**
     * Will fetch the entity with the URL {iri}. When a resource under that subject is already present, it will not
     * be fetched again.
     *
     * @deprecated Use {queueEntity} instead
     * @param iri The Node of the resource
     * @param opts The options for fetch-/processing the resource.
     * @return A promise with the resulting entity
     */
    public async getEntity(iri: NamedNode, opts?: FetchOpts): Promise<void> {
        const apiOpts: APIFetchOpts = {};
        let preExistingData;
        if (opts && opts.reload) {
            apiOpts.clearPreviousData = true;
            preExistingData = this.tryEntity(iri);
        }
        if (preExistingData !== undefined) {
            // TODO: refactor to use removeRecord
            this.store.removeQuads(preExistingData);
        }
        await this.api.getEntity(iri, apiOpts);
        return this.broadcast();
    }

    /**
     * Resolves all the properties {property} of resource {subject} to their statements.
     *
     * @renderlibrary This should only be used by render-libraries, not by application code.
     * @param {Node} subject The resource to get the properties for.
     * @param {Node | Node[]} property
     * @return {Statement[]} All the statements of {property} on {subject}, or an empty array when none are present.
     */
    public getResourcePropertyRaw(subject: Node | undefined, property: Node | Node[] | undefined): Quadruple[] {
        if (typeof subject === "undefined" || typeof property === "undefined") {
            return [];
        }

        return this.store.getResourcePropertyRaw(subject, property);
    }

    /**
     * Resolves all the properties {property} of resource {subject} to a value.
     *
     * @renderlibrary This should only be used by render-libraries, not by application code.
     * @typeParam TT The expected return type for the properties.
     * @param {Node} subject The resource to get the properties for.
     * @param {Node | Node[]} property
     * @return {Term[]} The resolved values of {property}, or an empty array when none are present.
     */
    public getResourceProperties<TT extends Term = SomeTerm>(
      subject: Node | undefined,
      property: Node | Node[] | undefined,
    ): TT[] {
        if (typeof subject === "undefined" || typeof property === "undefined") {
           return [];
        }

        return this.store.getResourceProperties<TT>(subject, property);
    }

    /**
     * Resolves the property {property} of resource {subject} to a value.
     *
     * When more than one statement on {property} is present, a random one will be chosen. See
     * {LinkedResourceContainer#getResourceProperties} to retrieve all the values.
     *
     * @renderlibrary This should only be used by render-libraries, not by application code.
     * @typeParam TT The expected return type for the property.
     * @param {Node} subject The resource to get the properties for.
     * @param {Node | Node[]} property
     * @return {Term | undefined} The resolved value of {property}, or undefined when none are present.
     */
    public getResourceProperty<TT extends Term = SomeTerm>(
      subject: Node | undefined,
      property: Node | Node[] | undefined,
    ): TT | undefined {
        if (typeof subject === "undefined" || typeof property === "undefined") {
            return undefined;
        }

        return this.store.getResourceProperty<TT>(subject, property);
    }

    public getState(recordId: Id): RecordStatus {
        return this.store.getInternalStore().store.getStatus(recordId);
    }

    /**
     * Retrieve the (network) status of the resource {iri}.
     *
     * Status 202 indicates that the resource has been queued for fetching (subject to change).
     * @deprecated
     */
    public getStatus(iri: Node): SomeRequestStatus {
        if (iri.termType === TermType.BlankNode) {
            return emptyRequest as EmptyRequestStatus;
        }

        if (this.resourceQueue.find(([resource]) => equals(resource, iri))) {
            return {
                lastRequested: new Date(),
                lastResponseHeaders: null,
                requested: true,
                status: 202,
                subject: iri,
                timesRequested: 1,
            };
        }

        return this.api.getStatus(iri);
    }

    /**
     * Process a linked-delta onto the store.
     *
     * This should generally only be called from the middleware or the data api
     * @param delta An array of [s, p, o, g] arrays containing the delta.
     * @param expedite Will immediately process the delta rather than waiting for an idle moment, useful in conjunction
     *  with event handlers within the UI needing immediate feedback. Might cause jumpy interfaces.
     */
    public processDelta(delta: Quadruple[], expedite = false): Promise<void> {
        const processors = this.deltaProcessors;
        for (let i = 0; i < processors.length; i++) {
            processors[i].processDelta(delta);
        }

        return this.broadcastWithExpedite(expedite);
    }

    /**
     * Bulk register components formatted with {LinkedRenderStore.registerRenderer}.
     * @see LinkedRenderStore.registerRenderer
     */
    public registerAll(...components: Array<ComponentRegistration<T> | Array<ComponentRegistration<T>>>): void {
        const registerItem = (i: ComponentRegistration<T>): void => {
            this.mapping.registerRenderer(
                i.component,
                i.type,
                i.property,
                i.topology,
            );
        };

        for (let i = 0; i < components.length; i++) {
            const innerRegs = normalizeType(components[i]);

            for (let j = 0; j < innerRegs.length; j++) {
                registerItem(innerRegs[j]);
            }
        }
    }

    /**
     * Remove a resource from the store, when views are still rendered the resource will be re-fetched.
     *
     * @unstable
     */
    public removeResource(subject: Node, expedite = false): Promise<void> {
        this.api.invalidate(subject);
        this.store.removeResource(subject);

        return this.broadcastWithExpedite(expedite);
    }

    /**
     * Resets the render store mappings and the schema graph.
     *
     * Note: This should only be used by render-libraries (e.g. link-redux), not by application code.
     */
    public reset(): void {
        this.store = new RDFStore();
        this.schema = new Schema(this.store);
        this.mapping = new ComponentStore(this.schema);
    }

    /**
     * Get a render component for a rendering {property} on resource {subject}.
     *
     * @renderlibrary
     * @param {Node} subject
     * @param {NamedNode | NamedNode[]} predicate
     * @param {NamedNode} topology
     * @return {T | undefined}
     */
    public resourcePropertyComponent(
        subject: Node,
        predicate: NamedNode | NamedNode[],
        topology?: NamedNode,
    ): T | null | undefined {
        return this.getComponentForProperty(
            this.store.getResourceProperties(subject, rdf.type) as NamedNode[],
            predicate,
            topology || DEFAULT_TOPOLOGY,
        );
    }

    /**
     * Get a render component for {subject}.
     *
     * @renderlibrary
     * @param {Node} subject The resource to get the renderer for.
     * @param {NamedNode} topology The topology to take into account when picking the renderer.
     * @return {T | undefined}
     */
    public resourceComponent(
        subject: Node,
        topology?: NamedNode,
    ): T | null | undefined {
        return this.getComponentForProperty(
            this.store.getResourceProperties(subject, rdf.type) as NamedNode[],
            RENDER_CLASS_NAME,
            topology || DEFAULT_TOPOLOGY,
        );
    }

    /**
     * Determine if it makes sense to load a resource.
     *
     * @renderlibrary
     * @unstable
     */
    public shouldLoadResource(subject: Node): boolean {
        const currentState = this.getState(subject.value).current;

        return subject.termType === "NamedNode" && currentState === RecordState.Absent;
    }

    /**
     * Listen for data changes by subscribing to store changes.
     *
     * @renderlibrary This should only be used by render-libraries, not by application code.
     * @param registration
     * @param registration[0] Will be called with the new statements as its argument.
     * @param registration[1] Options for the callback.
     * @return function Unsubscription function.
     */
    public subscribe(registration: SubscriptionRegistrationBase<unknown>): () => void {
        registration.subscribedAt = Date.now();
        const subjectFilter = registration.subjectFilter
          ?.map((s) => this.store.getInternalStore().store.primary(s));

        if (typeof subjectFilter !== "undefined") {
            for (let i = 0, len = subjectFilter.length; i < len; i++) {
                if (!this.subjectSubscriptions[subjectFilter[i]]) {
                    this.subjectSubscriptions[subjectFilter[i]] = [];
                }
                this.subjectSubscriptions[subjectFilter[i]].push(registration);
            }

            return (): void => {
                registration.markedForDelete = true;
                this.markForCleanup();
            };
        }

        this.bulkSubscriptions.push(registration);

        return (): void => {
            registration.markedForDelete = true;
            this.bulkSubscriptions.splice(this.bulkSubscriptions.indexOf(registration), 1);
        };
    }

    /** @internal */
    public touch(_iri: string | NamedNode, _err?: Error): boolean {
        this.broadcast();
        return true;
    }

    /**
     * Returns an entity from the cache directly.
     * This won't cause any network requests even if the entity can't be found.
     *
     * @renderlibrary This should only be used by render-libraries, not by application code.
     * @param iri The Node of the resource.
     * @returns The object if found, or undefined.
     */
    public tryEntity(iri: Node): Quadruple[] {
        return this.store.quadsFor(iri);
    }

    /** @deprecated Use getRecord */
    public tryRecord(id: Node | string): DataRecord | undefined {
        return this.getRecord(id);
    }

    /**
     * Returns a record from the store.
     * This won't cause any network requests even if the record isn't present.
     *
     * @param id The id of the resource.
     * @returns The object if found, or undefined.
     */
    public getRecord(id: Node | string): DataRecord | undefined {
        const recordId = typeof id === "string" ? id : id.value;
        return this.store.getInternalStore().store.getRecord(recordId);
    }

    /**
     * Returns a record from the store, inlining all local ids.
     * This won't cause any network requests even if the record isn't present.
     *
     * @param id The id of the resource.
     * @returns The object if found, or undefined.
     */
    public collectRecord(id: SomeNode | string): DeepRecord | undefined {
        const recordId = typeof id === "string" ? id : id.value;
        return this.store.getInternalStore().store.collectRecord(recordId);
    }

    /**
     * Broadcasts buffered to all subscribers.
     * The actual broadcast might be executed asynchronously to prevent lag.
     *
     * @param buffer Controls whether processing can be delayed until enough is available.
     * @param maxTimeout Set to 0 to execute immediately.
     * Note: This should only be used by render-libraries (e.g. link-redux), not by application code.
     */
    private broadcast(buffer = true, maxTimeout = 1000): Promise<void> {
        if (maxTimeout !== 0 && this.currentBroadcast || this.broadcastHandle) {
            return this.currentBroadcast || Promise.resolve();
        }

        if (buffer) {
            if (this.store.workAvailable() >= 2) {
                if (this.broadcastHandle) {
                    window.clearTimeout(this.broadcastHandle);
                }
                if ((this.lastPostponed === undefined) || Date.now() - this.lastPostponed <= maxTimeout) {
                    if (this.lastPostponed === undefined) {
                        this.lastPostponed = Date.now();
                    }
                    this.broadcastHandle = window.setTimeout(() => {
                        this.broadcastHandle = undefined;
                        this.broadcast(buffer, maxTimeout);
                    }, 200);

                    return this.currentBroadcast || Promise.resolve();
                }
            }
            this.lastPostponed = undefined;
            this.broadcastHandle = undefined;
        }
        if (this.store.workAvailable() === 0) {
            return Promise.resolve();
        }

        let flushResult = new Set<string>();
        for (const dp of this.deltaProcessors) {
            flushResult = new Set([...flushResult, ...Array.from(dp.flush())]);
        }
        const subjects = Array.from(flushResult);

        const subjectRegs = subjects
            .flatMap((sId) => this.subjectSubscriptions[sId])
            .filter((reg) => reg
                && !reg.markedForDelete
                && (reg.subjectFilter
                    ? reg.subjectFilter.some((s) => subjects.includes(s))
                    : true));

        if (this.bulkSubscriptions.length === 0 && subjectRegs.length === 0) {
            return Promise.resolve();
        }

        return this.currentBroadcast = new ProcessBroadcast({
            bulkSubscriptions: this.bulkSubscriptions.slice(),
            changedSubjects: subjects,
            subjectSubscriptions: subjectRegs,
            timeout: maxTimeout,
        }).run()
          .then(() => {
              this.currentBroadcast = undefined;
              if (this.store.workAvailable() > 0) {
                  this.broadcast();
              }
          });
    }

    private broadcastWithExpedite(expedite: boolean): Promise<void> {
        return this.broadcast(!expedite, expedite ? 0 : 500);
    }

    private markForCleanup(): void {
        if (this.cleanupTimer) {
            return;
        }

        this.cleanupTimer = window.setTimeout(() => {
            this.cleanupTimer = undefined;
            for (const [ k, v ] of Object.entries(this.subjectSubscriptions)) {
                this.subjectSubscriptions[k] = v.filter((p) => !p.markedForDelete);
            }
        }, this.cleanupTimout);
    }

    private scheduleResourceQueue(): void {
        if (this.resourceQueueHandle) {
            return;
        }

        if (typeof window === "undefined") {
            setTimeout(this.processResourceQueue, this.resourceQueueFlushTimer);
        } else if (typeof window.requestIdleCallback !== "undefined") {
            this.resourceQueueHandle = window.requestIdleCallback(
              this.processResourceQueue,
              { timeout: this.resourceQueueFlushTimer },
            );
        } else {
            this.resourceQueueHandle = window.setTimeout(
              this.processResourceQueue,
              this.resourceQueueFlushTimer,
            );
        }
    }

    private async processResourceQueue(): Promise<void> {
        this.resourceQueueHandle = undefined;
        const queue = this.resourceQueue;
        this.resourceQueue = [];

        if (this.bulkFetch) {
            await this.api.getEntities(queue);
            return this.broadcast();
        } else {
            for (let i = 0; i < queue.length; i++) {
                try {
                    const [iri, opts] = queue[i];
                    await this.getEntity(iri, opts);
                } catch (e) {
                    this.report(e);
                }
            }
        }
    }
}
