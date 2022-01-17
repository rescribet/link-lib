import { NamedNode } from "@ontologies/core";
import * as rdfs from "@ontologies/rdfs";

import { id } from "../factoryHelpers";
import ll from "../ontology/ll";
import { Schema } from "../Schema";
import { ComponentMapping, ComponentRegistration, Indexable } from "../types";
import { DEFAULT_TOPOLOGY } from "../utilities/constants";

import { ComponentCache } from "./ComponentCache";

const MSG_TYPE_ERR = "Non-optimized NamedNode instance given. Please memoize your namespace correctly.";

/** Constant used to determine that a component is used to render a type rather than a property. */
export const RENDER_CLASS_NAME: NamedNode = ll.typeRenderClass;

function convertToCacheKey(types: Indexable[], props: Indexable[], topology: Indexable): string {
    return `${types.join()}[${props.join()}][${topology}]`;
}

const assert = (obj: any): void => {
    if (obj === undefined) {
        throw new TypeError(MSG_TYPE_ERR);
    }
};

/**
 * Handles registration and querying for view components.
 */
export class ComponentStore<T> {
    /**
     * Generate registration description objects for later registration use.
     * @see LinkedRenderStore#registerAll
     */
    public static registerRenderer<T>(
        component: T,
        types: Indexable[],
        properties: Indexable[],
        topologies: Indexable[],
    ): Array<ComponentRegistration<T>> {
        if (typeof component === "undefined") {
            throw new Error(`Undefined component was given for (${types}, ${properties}, ${topologies}).`);
        }
        const registrations: Array<ComponentRegistration<T>> = [];

        for (let t = 0; t < types.length; t++) {
            assert(types[t]);
            for (let p = 0; p < properties.length; p++) {
                assert(properties[p]);
                for (let top = 0; top < topologies.length; top++) {
                    assert(topologies[top]);

                    registrations.push({
                        component,
                        property: properties[p],
                        topology: topologies[top],
                        type: types[t],
                    });
                }
            }
        }

        return registrations;
    }

    private lookupCache: ComponentCache<T> = new ComponentCache<T>();
    /**
     * Lookup map ordered with the following hierarchy;
     * [propertyType][resourceType][topology]
     */
    private registrations: ComponentMapping<T> = {};
    private schema: Schema;

    public constructor(schema: Schema) {
        this.schema = schema;
        this.registrations[id(RENDER_CLASS_NAME)] = {};
    }

    /**
     * TODO: remove defaultType - Basically a bug. We default the type if no matches were found, rather than using
     *   inheritance to associate unknown types the RDF way (using rdfs:Resource).
     */
    public getRenderComponent(
        types: Indexable[],
        predicates: Indexable[],
        topology: Indexable,
        defaultType: Indexable,
    ): T | undefined {
        const oTypes = this.schema.expand(types);
        const key = convertToCacheKey(oTypes, predicates, topology);
        const cached = this.lookupCache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        for (let p = 0; p < predicates.length; p++) {
            for (let t = 0; t < oTypes.length; t++) {
                const exact = this.lookup(predicates[p], oTypes[t], topology);
                if (exact !== undefined) {
                    return this.lookupCache.add(exact, key);
                }
            }
        }

        const possibleComponents = this.possibleComponents(predicates, topology);
        if (possibleComponents.length === 0) {
            if (topology === id(DEFAULT_TOPOLOGY)) {
                return undefined;
            }
            const foundComponent = this.getRenderComponent(
                oTypes,
                predicates,
                id(DEFAULT_TOPOLOGY),
                defaultType,
            );
            if (!foundComponent) {
                return undefined;
            }

            return this.lookupCache.add(foundComponent, key);
        }
        for (let i = 0; i < predicates.length; i++) {
            const bestComponent = this.bestComponent(possibleComponents, oTypes);
            const component = bestComponent && this.lookup(
                predicates[i],
                bestComponent,
                topology,
            );
            if (component) {
                return this.lookupCache.add(component, key);
            }
        }
        for (let i = 0; i < predicates.length; i++) {
            const component = this.lookup(predicates[i], defaultType, topology);
            if (component) {
                return this.lookupCache.add(component, key);
            }
        }

        return undefined;
    }

    /**
     * Register a renderer for a type/property.
     * @param component The component to return for the rendering of the object.
     * @param type The type's SomeNode of the object which the {component} can render.
     * @param [property] The property's SomeNode if the {component} is a subject renderer.
     * @param [topology] An alternate topology this {component} should render.
     */
    public registerRenderer(
        component: T,
        type: Indexable,
        property: Indexable = id(RENDER_CLASS_NAME),
        topology: Indexable = id(DEFAULT_TOPOLOGY),
    ): void {
        if (!property || !type) {
            return;
        }

        this.store(component, property, type, topology);
        this.lookupCache.clear();
    }

    /**
     * Find a component from a cache.
     * @param predicate The index of the property (or {RENDER_CLASS_NAME})
     * @param obj The index of either the resource type or resource IRI
     * @param topology The index of the topology
     * @param cache The cache to look into (defaults to the mapping)
     * @returns The appropriate component if any
     */
    protected lookup(
        predicate: Indexable,
        obj: Indexable,
        topology: Indexable,
        cache: ComponentMapping<T> = this.registrations,
    ): T | undefined {
        const predMap = cache[predicate];
        if (!predMap || !predMap[obj]) {
            return undefined;
        }

        return predMap[obj][topology];
    }

    /** Store a component to a cache. */
    protected store(
        component: T,
        predicate: Indexable,
        obj: Indexable,
        topology: Indexable,
        cache: ComponentMapping<T> = this.registrations,
    ): void {
        if (typeof cache[predicate] === "undefined") {
            cache[predicate] = {};
        }
        if (typeof cache[predicate][obj] === "undefined") {
            cache[predicate][obj] = {};
        }
        cache[predicate][obj][topology] = component;
    }

    /**
     * Expands the given types and returns the best component to render it with.
     * @param components The set of components to choose from.
     * @param [types] The types to expand on.
     * @returns The best match for the given components and types.
     */
    private bestComponent(components: Indexable[], types: Indexable[]): Indexable | undefined {
        if (types.length > 0) {
            const direct = this.schema.sort(types).find((c) => components.indexOf(c) >= 0);
            if (direct) {
                return direct;
            }
        }

        const chain = this.schema.expand(types || []);

        return components.find((c) => chain.indexOf(c) > 0);
    }

    private possibleComponents(predicates: Indexable[], topology: Indexable): Indexable[] {
        const classes = [id(rdfs.Resource)];
        for (let i = 0; i < predicates.length; i++) {
            const predicate = predicates[i];
            if (typeof this.registrations[predicate] !== "undefined") {
                const types = Object.values(this.registrations[predicate]);
                for (let j = 0; j < types.length; j++) {
                    const compType = this.lookup(predicate, j, topology);
                    if (compType !== undefined) {
                        classes.push(j);
                    }
                }
            }
        }

        return classes;
    }
}
