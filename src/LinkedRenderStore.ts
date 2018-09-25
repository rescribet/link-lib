/* eslint no-console: 0 */

import {
    FetchOpts as RDFFetchOpts,
    Literal,
    NamedNode,
    SomeTerm,
    Statement,
} from "rdflib";

import { ComponentStore } from "./ComponentStore";
import { LinkedDataAPI } from "./LinkedDataAPI";
import { DataProcessor, emptyRequest } from "./processor/DataProcessor";
import { dataToGraphTuple } from "./processor/DataToGraph";
import { RDFStore } from "./RDFStore";
import { Schema } from "./Schema";
import {
    ComponentRegistration,
    DataObject,
    Dispatcher,
    EmptyRequestStatus,
    FetchOpts,
    FulfilledRequestStatus,
    LazyNNArgument,
    LinkedActionResponse,
    LinkedRenderStoreOptions,
    MiddlewareActionHandler,
    NamespaceMap,
    SomeNode,
    SubscriptionRegistration,
} from "./types";
import { normalizeType } from "./utilities";
import { DEFAULT_TOPOLOGY, defaultNS, RENDER_CLASS_NAME } from "./utilities/constants";
import { expandProperty, namedNodeByIRI } from "./utilities/memoizedNamespace";

declare global {
    interface Window {
        requestIdleCallback: (callback: any, opts: object) => void;
    }
}

export class LinkedRenderStore<T> implements Dispatcher {
    public static registerRenderer<T>(
        component: T,
        type: LazyNNArgument,
        prop: LazyNNArgument = RENDER_CLASS_NAME,
        topology: LazyNNArgument | Array<NamedNode | undefined> = DEFAULT_TOPOLOGY): Array<ComponentRegistration<T>> {

        const types = normalizeType(type);
        const props = normalizeType(prop)
            .map((p) => p || RENDER_CLASS_NAME);
        const topologies = normalizeType(topology)
            .map((t) => t || DEFAULT_TOPOLOGY);

        return ComponentStore.registerRenderer(component, types, props, topologies);
    }

    /** Whenever a resource has no type, assume it to be this. */
    public defaultType: NamedNode = defaultNS.schema("Thing");
    public namespaces: NamespaceMap = {...defaultNS};

    private api: LinkedDataAPI;
    private mapping: ComponentStore<T>;
    private _dispatch?: MiddlewareActionHandler;
    private schema: Schema;
    private store: RDFStore = new RDFStore();
    private subscriptions: SubscriptionRegistration[] = [];
    private lastPostponed: number | undefined;

    // tslint:disable-next-line no-object-literal-type-assertion
    public constructor(opts: LinkedRenderStoreOptions<T> = {} as LinkedRenderStoreOptions<T>) {
        if (opts.store) {
            this.store = opts.store;
        }

        this.api = opts.api || new DataProcessor({
            dispatch: opts.dispatch,
            store: this.store,
        });
        if (opts.dispatch) {
            this.dispatch = opts.dispatch;
        }
        this.defaultType = opts.defaultType || defaultNS.schema("Thing");
        this.namespaces = opts.namespaces || {...defaultNS};
        this.schema = opts.schema || new Schema(this.store);
        this.mapping = opts.mapping || new ComponentStore(this.schema);
    }

    public get dispatch(): MiddlewareActionHandler {
        if (typeof this._dispatch === "undefined") {
            throw new Error("Invariant: cannot call `dispatch` before initialization is complete");
        }

        return this._dispatch;
    }

    public set dispatch(value: MiddlewareActionHandler) {
        this._dispatch = value;
        this.api.dispatch = value;
    }

    /**
     * Push one or more ontological items onto the graph so it can be used by the render store for component
     * determination.
     *
     * Adding information after the initial render currently conflicts with the caching and will result in inconsistent
     * results.
     */
    public addOntologySchematics(items: Statement[]): void {
        this.schema.addStatements(items);
    }

    /**
     * Execute an Action by its IRI. This will result in an HTTP request being done and probably some state changes.
     * @param {module:rdflib.NamedNode} subject The resource to execute. Generally a schema:Action derivative with a
     *   schema:EntryPoint to describe the request. Currently schema:url is used over schema:urlTemplate
     *   to acquire the request URL, since template processing isn't implemented (yet).
     * @param {DataObject} data An object to send in the body when a non-safe method is used.
     * @return {Promise<LinkedActionResponse>}
     */
    public execActionByIRI(subject: NamedNode, data?: DataObject): Promise<LinkedActionResponse> {
        const preparedData = dataToGraphTuple(data || {});
        return this
            .api
            .execActionByIRI(subject, preparedData)
            .then((res: LinkedActionResponse) => {
                this.store.processDelta(res.data);
                this.broadcast(false, 100);
                return res;
            });
    }

    /**
     * Execute a resource.
     *
     * Every action will fall through the execution middleware layers.
     *
     * @see https://github.com/fletcher91/link-lib/wiki/%5BDesign-draft%5D-Actions,-data-streams,-and-middleware
     *
     * @param {NamedNode} subject The resource to execute (can be either an IRI or an URI)
     * @param {Object} args The arguments to the function defined by the subject.
     */
    public async exec(subject: NamedNode, args?: DataObject): Promise<any> {
        return this.dispatch(subject, args);
    }

    /**
     * Convert a string value to a NamedNode if possible. Useful for looking op dynamic data like user input. Please
     * refrain from using in static code, as this will impact performance.
     */
    public expandProperty(prop: NamedNode | string | undefined): NamedNode | undefined {
        return expandProperty(prop, this.namespaces);
    }

    /**
     * Finds the best render component for a given property in respect to a topology.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @param type The type(s) of the resource to render.
     * @param predicate The predicate(s) (property(s)) to render.
     * @param [topology] The topology of the resource, if any
     * @returns The most appropriate renderer, if any.
     */
    public getComponentForProperty(type: NamedNode | NamedNode[] | undefined = this.defaultType,
                                   predicate: NamedNode | NamedNode[],
                                   topology: NamedNode = DEFAULT_TOPOLOGY): T | undefined {
        if (type === undefined || (Array.isArray(type) && type.length === 0)) {
            return undefined;
        }
        const types = normalizeType(type);
        const predicates = normalizeType(predicate);

        return this.mapping.getRenderComponent(types, predicates, topology, this.defaultType);
    }

    /**
     * Finds the best render component for a type in respect to a topology.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @see LinkedRenderStore#getComponentForProperty
     * @param type The type(s) of the resource to render.
     * @param [topology] The topology of the resource, if any
     * @returns The most appropriate renderer, if any.
     */
    public getComponentForType(type: NamedNode | NamedNode[], topology: NamedNode = DEFAULT_TOPOLOGY): T | undefined {
        return this.getComponentForProperty(type, RENDER_CLASS_NAME, topology);
    }

    /**
     * Will fetch the entity with the URL {iri}. When a resource under that subject is already present, it will not
     * be fetched again.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @param iri The SomeNode of the resource
     * @param opts The options for fetch-/processing the resource.
     * @return A promise with the resulting entity
     */
    public async getEntity(iri: NamedNode, opts?: FetchOpts): Promise<void> {
        const apiOpts: RDFFetchOpts = {};
        let preExistingData;
        if (opts && opts.reload) {
            apiOpts.force = true;
            apiOpts.clearPreviousData = true;
            preExistingData = this.tryEntity(iri);
        }
        const data = await this.api.getEntity(iri, apiOpts);
        if (preExistingData !== undefined) {
            this.store.removeStatements(preExistingData);
        }
        await this.store.processDelta(data);
        this.broadcast();
    }

    /**
     * Resolves all the properties {property} of resource {subject} to their statements.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @param {SomeNode} subject The resource to get the properties for.
     * @param {SomeNode | SomeNode[]} property
     * @return {Statement[]} All the statements of {property} on {subject}, or an empty array when none are present.
     */
    public getResourcePropertyRaw(subject: SomeNode, property: SomeNode | SomeNode[]): Statement[] {
        return this.store.getResourcePropertyRaw(subject, property);
    }

    /**
     * Resolves all the properties {property} of resource {subject} to a value.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @param {SomeNode} subject The resource to get the properties for.
     * @param {SomeNode | SomeNode[]} property
     * @return {SomeTerm[]} The resolved values of {property}, or an empty array when none are present.
     */
    public getResourceProperties(subject: SomeNode, property: SomeNode | SomeNode[]): SomeTerm[] {
        return this.store.getResourceProperties(subject, property);
    }

    /**
     * Resolves the property {property} of resource {subject} to a value.
     *
     * When more than one statement on {property} is present, a random one will be chosen. See
     * {LinkedResourceContainer#getResourceProperties} to retrieve all the values.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @param {SomeNode} subject The resource to get the properties for.
     * @param {SomeNode | SomeNode[]} property
     * @return {SomeTerm | undefined} The resolved value of {property}, or undefined when none are present.
     */
    public getResourceProperty(subject: SomeNode, property: SomeNode | SomeNode[]): SomeTerm | undefined {
        return this.store.getResourceProperty(subject, property);
    }

    public getStatus(iri: SomeNode): EmptyRequestStatus | FulfilledRequestStatus {
        if (iri.termType === "BlankNode") {
            return emptyRequest as EmptyRequestStatus;
        }

        return this.api.getStatus(iri);
    }

    /**
     * Bulk register components formatted with {LinkedRenderStore.registerRenderer}.
     * @see LinkedRenderStore.registerRenderer
     */
    public registerAll(...components: Array<ComponentRegistration<T> | Array<ComponentRegistration<T>>>): void {
        const registerItem = (i: ComponentRegistration<T>): void => {
            this.mapping.registerRenderer(i.component, i.type, i.property, i.topology);
        };
        for (let i = 0; i < components.length; i++) {
            if (Array.isArray(components[i])) {
                for (let j = 0; j < (components[i] as Array<ComponentRegistration<T>>).length; j++) {
                    registerItem((components[i] as Array<ComponentRegistration<T>>)[j]);
                }
            } else {
                registerItem(components[i] as ComponentRegistration<T>);
            }
        }
    }

    /**
     * Resets the render store mappings and the schema graph.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     */
    public reset(): void {
        this.store = new RDFStore();
        this.schema = new Schema(this.store);
        this.mapping = new ComponentStore(this.schema);
    }

    /**
     * Get a render component for a rendering {property} on resource {subject}.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @param {SomeNode} subject
     * @param {NamedNode | NamedNode[]} predicate
     * @param {NamedNode} topology
     * @return {T | undefined}
     */
    public resourcePropertyComponent(subject: SomeNode,
                                     predicate: NamedNode | NamedNode[],
                                     topology?: NamedNode): T | undefined {
        return this.getComponentForProperty(
            this.store.getResourceProperties(subject, defaultNS.rdf("type")) as NamedNode[],
            predicate,
            topology || DEFAULT_TOPOLOGY,
        );
    }

    /**
     * Get a render component for {subject}.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @param {SomeNode} subject The resource to get the renderer for.
     * @param {"rdflib".NamedNode} topology The topology to take into account when picking the renderer.
     * @return {T | undefined}
     */
    public resourceComponent(subject: SomeNode, topology?: NamedNode): T | undefined {
        return this.getComponentForProperty(
            this.store.getResourceProperties(subject, defaultNS.rdf("type")) as NamedNode[],
            RENDER_CLASS_NAME,
            topology || DEFAULT_TOPOLOGY,
        );
    }

    /**
     * Listen for data changes by subscribing to store changes.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @param registration
     * @param registration[0] Will be called with the new statements as its argument.
     * @param registration[1] Options for the callback.
     * @param registration[1].onlySubjects Only the subjects are passed when true.
     */
    public subscribe(registration: SubscriptionRegistration): void {
        this.subscriptions.push(registration);
    }

    /** @internal */
    public touch(iri: string | NamedNode, _err?: Error): boolean {
        const resource = typeof iri === "string" ? namedNodeByIRI(iri) : iri;
        this.store.addStatements([new Statement(resource, defaultNS.ll("nop"), Literal.fromValue(0))]);
        this.broadcast();
        return true;
    }

    /**
     * Returns an entity from the cache directly.
     * This won't cause any network requests even if the entity can't be found.
     *
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     * @param iri The SomeNode of the resource.
     * @returns The object if found, or undefined.
     */
    public tryEntity(iri: SomeNode): Statement[] {
        return this.store.statementsFor(iri);
    }

    /**
     * Broadcasts buffered to all subscribers.
     * The actual broadcast might be executed asynchronously to prevent lag.
     *
     * Note: This should only be used by render-libraries (e.g. link-redux), not by application code.
     */
    private broadcast(buffer = true, maxTimeout = 500): void {
        if (buffer) {
            if (this.store.workAvailable() < 100) {
                if (this.lastPostponed === undefined) {
                    this.lastPostponed = Date.now();
                    window.setTimeout(this.broadcast.bind(this), 100);
                    return;
                } else if (Date.now() - this.lastPostponed <= maxTimeout) {
                    window.setTimeout(this.broadcast.bind(this), 100);
                    return;
                }
            }
            this.lastPostponed = undefined;
            if (this.store.workAvailable() === 0) {
                return;
            }
        }
        if ("requestIdleCallback" in window) {
            window.requestIdleCallback(this.processBroadcast.bind(this), {timeout: maxTimeout});
        } else {
            this.processBroadcast();
        }
    }

    private processBroadcast(): void {
        const processingBuffer = this.store.flush();
        if (processingBuffer.length === 0) {
            return;
        }

        let subjects: SomeNode[];
        if (this.subscriptions.length >= 2) {
            subjects = processingBuffer.map((s) => s.subject);
        }
        this.subscriptions.forEach((registration) => {
            if (registration.onlySubjects) {
                registration.callback(subjects || processingBuffer.map((s) => s.subject));
            } else {
                registration.callback(processingBuffer);
            }
        });
    }
}
