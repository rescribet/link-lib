/* eslint no-console: 0 */

import {
    NamedNamespace,
    NamedNode,
    SomeTerm,
    Statement,
    TermIsh,
} from "rdflib";

import { ComponentStore } from "./ComponentStore";
import { LinkedDataAPI } from "./LinkedDataAPI";
import { RDFStore } from "./RDFStore";
import { Schema } from "./Schema";
import {
    ComponentRegistration,
    LazyNNArgument,
    LinkedRenderStoreOptions,
    NamespaceMap,
    SomeNode,
    SubscriptionRegistration,
} from "./types";
import {
    defaultNS,
    normalizeType,
} from "./utilities";

const CI_MATCH_PREFIX = 0;
const CI_MATCH_SUFFIX = 1;

export const DEFAULT_TOPOLOGY: NamedNode = defaultNS.ll("defaultTopology");

/** Constant used to determine that a class is used to render a type rather than a property. */
export const RENDER_CLASS_NAME: NamedNode = defaultNS.ll("typeRenderClass");

declare global {
    interface Window {
        requestIdleCallback: (callback: any, opts: object) => void;
    }
}

export class LinkedRenderStore<T> {
    /**
     * Expands a property if it's in short-form while preserving long-form.
     * Note: The vocabulary needs to be present in the store prefix library
     * @param prop The short- or long-form property
     * @param namespaces Object of namespaces by their abbreviation.
     * @returns The (expanded) property
     */
    public static expandProperty(prop: NamedNode | TermIsh | string | undefined,
                                 namespaces: NamespaceMap = {}): NamedNode | undefined {
        if (prop instanceof NamedNode || typeof prop === "undefined") {
            return prop;
        }
        if (typeof prop === "object") {
            if (prop.termType === "NamedNode") {
                return new NamedNode(prop.value);
            }

            return undefined;
        }

        if (prop.indexOf("/") >= 1) {
            return new NamedNode(prop);
        }
        const matches = prop.split(":");
        const constructor: NamedNamespace | undefined = namespaces[matches[CI_MATCH_PREFIX]];

        return constructor && constructor(matches[CI_MATCH_SUFFIX]);
    }

    public static registerRenderer<T>(component: T,
                                      type: LazyNNArgument,
                                      prop: LazyNNArgument = RENDER_CLASS_NAME,
                                      topology: LazyNNArgument = DEFAULT_TOPOLOGY): Array<ComponentRegistration<T>> {
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
    private schema: Schema;
    private store: RDFStore = new RDFStore();
    private subscriptions: SubscriptionRegistration[] = [];
    private lastPostponed: number | undefined;

    // tslint:disable-next-line no-object-literal-type-assertion
    public constructor(opts: LinkedRenderStoreOptions<T> = {} as LinkedRenderStoreOptions<T>) {
        if (opts.store) {
            this.store = opts.store;
        }

        this.api = opts.api || new LinkedDataAPI({dataProcessorOpts: {store: this.store}});
        this.defaultType = opts.defaultType || defaultNS.schema("Thing");
        this.namespaces = opts.namespaces || {...defaultNS};
        this.schema = opts.schema || new Schema(this.store);
        this.mapping = opts.mapping || new ComponentStore(this.schema);
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
     * Convert a string value to a NamedNode if possible. Useful for looking op dynamic data like user input. Please
     * refrain from using in static code, as this will impact performance.
     * @see LinkedRenderStore.expandProperty
     */
    public expandProperty(prop: NamedNode | string | undefined): NamedNode | undefined {
        return LinkedRenderStore.expandProperty(prop, this.namespaces);
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
     * @return A promise with the resulting entity
     */
    public async getEntity(iri: NamedNode): Promise<void> {
        const data = await this.api.getEntity(iri);

        await this.store.addStatements(data);
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

    /**
     * Bulk register components formatted with {LinkedRenderStore.registerRenderer}.
     * @see LinkedRenderStore.registerRenderer
     */
    public registerAll(...components: Array<ComponentRegistration<T> | Array<ComponentRegistration<T>>>): void {
        const registerItem = (i: ComponentRegistration<T>): void => {
            this.mapping.registerRenderer(i.component, i.type, i.property, i.topology);
        };
        components.forEach((c: ComponentRegistration<T> | Array<ComponentRegistration<T>>) => {
            Array.isArray(c) ? c.forEach(registerItem) : registerItem(c);
        });
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
                                     topology: NamedNode = DEFAULT_TOPOLOGY): T | undefined {
        return this.getComponentForProperty(
            this.store.getResourceProperties(subject, defaultNS.rdf("type")) as NamedNode[],
            predicate,
            topology,
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
    public resourceComponent(subject: SomeNode, topology: NamedNode = DEFAULT_TOPOLOGY): T | undefined {
        return this.getComponentForProperty(
            this.store.getResourceProperties(subject, defaultNS.rdf("type")) as NamedNode[],
            RENDER_CLASS_NAME,
            topology,
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
     * Note: This should only be used by render-libraries (e.g. link-lib), not by application code.
     */
    private broadcast(): void {
        if (this.store.workAvailable() < 100) {
            if (this.lastPostponed === undefined) {
                this.lastPostponed = Date.now();
                window.setTimeout(this.broadcast.bind(this), 100);
                return;
            } else if (Date.now() - this.lastPostponed <= 500) {
                window.setTimeout(this.broadcast.bind(this), 100);
                return;
            }
        }
        this.lastPostponed = undefined;
        if (this.store.workAvailable() === 0) {
            return;
        }
        if ("requestIdleCallback" in window) {
            window.requestIdleCallback(this.processBroadcast.bind(this), {timeout: 500});
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
