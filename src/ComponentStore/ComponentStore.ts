import { NamedNode } from "@ontologies/core";
import * as rdfs from "@ontologies/rdfs";

import { Id } from "../datastrucures/DataSlice";
import ll from "../ontology/ll";
import { Schema } from "../Schema";
import { ComponentMapping, ComponentRegistration } from "../types";
import { DEFAULT_TOPOLOGY } from "../utilities/constants";

import { ComponentCache } from "./ComponentCache";

const MSG_TYPE_ERR = "Non-optimized NamedNode instance given. Please memoize your namespace correctly.";

/** Constant used to determine that a component is used to render a type rather than a property. */
export const RENDER_CLASS_NAME: NamedNode = ll.typeRenderClass;

function convertToCacheKey(types: Id[], props: Id[], topology: Id): string {
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
        types: Id[],
        fields: Id[],
        topologies: Id[],
    ): Array<ComponentRegistration<T>> {
        if (typeof component === "undefined") {
            throw new Error(`Undefined component was given for (${types}, ${fields}, ${topologies}).`);
        }
        const registrations: Array<ComponentRegistration<T>> = [];

        for (let t = 0; t < types.length; t++) {
            assert(types[t]);
            for (let p = 0; p < fields.length; p++) {
                assert(fields[p]);
                for (let top = 0; top < topologies.length; top++) {
                    assert(topologies[top]);

                    registrations.push({
                        component,
                        property: fields[p],
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
        this.registrations[RENDER_CLASS_NAME.value] = {};
    }

    /**
     * TODO: remove defaultType - Basically a bug. We default the type if no matches were found, rather than using
     *   inheritance to associate unknown types the RDF way (using rdfs:Resource).
     */
    public getRenderComponent(
        types: Id[],
        fields: Id[],
        topology: Id,
        defaultType: Id,
    ): T | null {
        const oTypes = this.schema.expand(types);
        const key = convertToCacheKey(oTypes, fields, topology);
        const cached = this.lookupCache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const match = this.findMatch(oTypes, fields, topology, defaultType);

        return this.lookupCache.add(match, key);
    }

    /**
     * Register a renderer for a type/property.
     * @param component The component to return for the rendering of the object.
     * @param type The type's SomeNode of the object which the {component} can render.
     * @param [field] The property's SomeNode if the {component} is a subject renderer.
     * @param [topology] An alternate topology this {component} should render.
     */
    public registerRenderer(
        component: T,
        type: Id,
        field: Id = RENDER_CLASS_NAME.value,
        topology: Id = DEFAULT_TOPOLOGY.value,
    ): void {
        if (!field || !type) {
            return;
        }

        this.store(component, field, type, topology);
        this.lookupCache.clear();
    }

    /**
     * Find a component from a cache.
     * @param field The property (or {RENDER_CLASS_NAME})
     * @param klass Either the resource type or resource IRI
     * @param topology The topology
     * @param cache The cache to look into (defaults to the mapping)
     * @returns The appropriate component if any
     */
    protected lookup(
        field: Id,
        klass: Id,
        topology: Id,
        cache: ComponentMapping<T> = this.registrations,
    ): T | undefined {
        const predMap = cache[field];
        if (!predMap || !predMap[klass]) {
            return undefined;
        }

        return predMap[klass][topology];
    }

    /** Store a component to a cache. */
    protected store(
        component: T,
        field: Id,
        klass: Id,
        topology: Id,
        cache: ComponentMapping<T> = this.registrations,
    ): void {
        if (typeof cache[field] === "undefined") {
            cache[field] = {};
        }
        if (typeof cache[field][klass] === "undefined") {
            cache[field][klass] = {};
        }
        cache[field][klass][topology] = component;
    }

    /**
     * Expands the given types and returns the best class to render it with.
     * @param components The set of components to choose from.
     * @param [types] The types to expand on.
     * @returns The best match for the given components and types.
     */
    private bestClass(components: Id[], types: Id[]): Id | undefined {
        if (types.length > 0) {
            const direct = this.schema.sort(types).find((c) => components.indexOf(c) >= 0);
            if (direct) {
                return direct;
            }
        }

        const chain = this.schema.expand(types ?? []);

        return components.find((c) => chain.indexOf(c) > 0);
    }

    private classMatch(possibleClasses: Id[], types: Id[], fields: Id[], topology: Id): T | undefined {
        for (let i = 0; i < fields.length; i++) {
            const bestClass = this.bestClass(possibleClasses, types);
            const component = bestClass && this.lookup(
              fields[i],
              bestClass,
              topology,
            );

            if (component) {
                return component;
            }
        }

        return undefined;
    }

    private defaultMatch(fields: Id[], topology: Id, defaultType: Id): T | undefined {
        for (let i = 0; i < fields.length; i++) {
            const component = this.lookup(fields[i], defaultType, topology);
            if (component) {
                return component;
            }
        }

        return undefined;
    }

    private exactMatch(types: Id[], fields: Id[], topology: Id): T | undefined {
        for (let p = 0; p < fields.length; p++) {
            for (let t = 0; t < types.length; t++) {
                const exact = this.lookup(fields[p], types[t], topology);
                if (exact !== undefined) {
                    return exact;
                }
            }
        }

        return undefined;
    }

    private findMatch(types: Id[], fields: Id[], topology: Id, defaultType: Id): T | null {
        let match: T | null | undefined = this.exactMatch(types, fields, topology);
        if (match !== undefined) {
            return match;
        }

        const possibleClasses = this.registeredClasses(fields, topology);

        if (possibleClasses.length === 0) {
            return this.noClassesMatch(types, fields, topology, defaultType);
        }

        match = this.classMatch(possibleClasses, types, fields, topology);
        if (match !== undefined) {
            return match;
        }

        match = this.defaultMatch(fields, topology, defaultType);
        if (match !== undefined) {
            return match;
        }

        return null;
    }

    private noClassesMatch(types: Id[], fields: Id[], topology: Id, defaultType: Id): T | null {
        if (topology === DEFAULT_TOPOLOGY.value) {
            return null;
        }

        const foundComponent = this.getRenderComponent(
          types,
          fields,
          DEFAULT_TOPOLOGY.value,
          defaultType,
        );

        if (foundComponent) {
            return foundComponent;
        }

        return null;
    }

    /**
     * Returns a list of classes which have registrations for a combination of {fields} and {topology}.
     * @private
     */
    private registeredClasses(fields: Id[], topology: Id): Id[] {
        const classes = [rdfs.Resource.value];

        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];

            if (typeof this.registrations[field] === "undefined") {
                continue;
            }

            const types = Object.keys(this.registrations[field]);
            for (let j = 0; j < types.length; j++) {
                const compType = this.lookup(field, types[j], topology);
                if (compType !== undefined) {
                    classes.push(types[j]);
                }
            }
        }

        return classes;
    }
}
