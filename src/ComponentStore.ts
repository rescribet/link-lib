import { NamedNode } from "rdflib";

import { Schema } from "./Schema";
import { ComponentRegistration } from "./types";
import {
    DEFAULT_TOPOLOGY,
    defaultNS,
    namedNodeByStoreIndex,
} from "./utilities";

const MSG_TYPE_ERR = "Non-optimized NamedNode instance given. Please memoize your namespace correctly.";

/** Constant used to determine that a component is used to render a type rather than a property. */
export const RENDER_CLASS_NAME: NamedNode = defaultNS.ll("typeRenderClass");

function convertToCacheKey(types: NamedNode[], props: NamedNode[], topology: NamedNode): string {
    const sType = types.map((t) => t.sI).join();
    return (props.length > 1)
        ? `${sType}[${props.map((p) => p.sI).join()}][${topology.sI}]`
        : `${sType}[${props[0].sI}][${topology.sI}]`;
}

/**
 * Handles registration and querying for view components.
 */
export class ComponentStore<T> {
    /**
     * Generate registration description objects for later registration use.
     * @see LinkedRenderStore#registerAll
     */
    public static registerRenderer<T>(component: T,
                                      types: NamedNode[],
                                      properties: NamedNode[],
                                      topologies: NamedNode[]): Array<ComponentRegistration<T>> {
        if (typeof component === "undefined") {
            throw new Error(`Undefined component was given for (${types}, ${properties}, ${topologies}).`);
        }
        const registrations: Array<ComponentRegistration<T>> = [];

        types.forEach((t) => {
            properties.forEach((p) => {
                topologies.forEach((top) => {
                    if (p.sI === undefined
                        || top.sI === undefined
                        || t.sI === undefined) {
                        throw new TypeError(MSG_TYPE_ERR);
                    }
                    registrations.push({
                        component,
                        property: p,
                        topology: top,
                        type: t,
                    });
                });
            });
        });

        return registrations;
    }

    private lookupCache: { [s: string]: T } = {};
    /**
     * Lookup map ordered with the following hierarchy;
     * [propertyType][resourceType][topology]
     */
    private mapping: T[][][] = [];
    private schema: Schema;

    public constructor(schema: Schema) {
        this.schema = schema;
        this.mapping[RENDER_CLASS_NAME.sI] = [];
    }

    /**
     * TODO: remove defaultType - Basically a bug. We default the type if no matches were found, rather than using
     *   inheritance to associate unknown types the RDF way (using rdfs:Resource).
     */
    public getRenderComponent(types: NamedNode[],
                              predicates: NamedNode[],
                              topology: NamedNode,
                              defaultType: NamedNode): T | undefined {
        const oTypes = this.schema.sort(types);
        const key = convertToCacheKey(oTypes, predicates, topology);
        const cached = this.getComponentFromCache(key);
        if (cached !== undefined) {
            return cached;
        }

        for (const lookupType of oTypes) {
            const exact = this.lookup(predicates[0].sI, lookupType.sI, topology.sI);
            if (exact !== undefined) {
                return this.addComponentToCache(exact, key);
            }
        }

        const possibleComponents = this.possibleComponents(predicates, topology);
        if (possibleComponents.length === 0) {
            if (topology === DEFAULT_TOPOLOGY) {
                return undefined;
            }
            const foundComponent = this.getRenderComponent(oTypes, predicates, DEFAULT_TOPOLOGY, defaultType);
            if (!foundComponent) {
                return undefined;
            }

            return this.addComponentToCache(foundComponent, key);
        }
        for (const lookupProp of predicates) {
            const bestComponent = this.bestComponent(possibleComponents, oTypes);
            const component = bestComponent && this.lookup(
                lookupProp.sI,
                bestComponent.sI,
                topology.sI,
            );
            if (component) {
                return this.addComponentToCache(component, key);
            }
        }
        for (const lookupProp of predicates) {
            const component = this.lookup(lookupProp.sI, defaultType.sI, topology.sI);
            if (component) {
                return this.addComponentToCache(component, key);
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
    public registerRenderer(component: T,
                            type: NamedNode,
                            property: NamedNode = RENDER_CLASS_NAME,
                            topology: NamedNode = DEFAULT_TOPOLOGY): void {
        if (!property || !type) {
            return;
        }
        if (type.sI === undefined
            || property.sI === undefined
            || topology.sI === undefined) {
            throw new TypeError("Non-optimized NamedNode instance given. Please memoize your namespace correctly.");
        }

        if (typeof this.mapping[property.sI] === "undefined") {
            this.mapping[property.sI] = [];
        }
        if (typeof this.mapping[property.sI][type.sI] === "undefined") {
            this.mapping[property.sI][type.sI] = [];
        }
        this.mapping[property.sI][type.sI][topology.sI] = component;
        this.lookupCache = {};
    }

    /**
     * Find a component from the mapping.
     * @param predicate The SomeNode of the property (or {RENDER_CLASS_NAME})
     * @param type The SomeNode of the resource type
     * @param topology The SomeNode of the topology
     * @returns The appropriate component if any
     */
    protected lookup(predicate: number,
                     type: number,
                     topology: number): T | undefined {
        const predMap = this.mapping[predicate];
        if (!predMap || !predMap[type]) {
            return undefined;
        }

        return predMap[type][topology];
    }

    /**
     * Adds a renderer to {this.lookupCache}
     * @param component The render component.
     * @param key The memoization key.
     * @returns The renderer passed with {component}
     */
    private addComponentToCache(component: T, key: string): T {
        this.lookupCache[key] = component;

        return this.lookupCache[key];
    }

    /**
     * Expands the given types and returns the best component to render it with.
     * @param components The set of components to choose from.
     * @param [types] The types to expand on.
     * @returns The best match for the given components and types.
     */
    private bestComponent(components: NamedNode[], types: NamedNode[]): NamedNode | undefined {
        if (types.length > 0) {
            const direct = this.schema.sort(types).find((c) => components.indexOf(c) >= 0);
            if (direct) {
                return direct;
            }
        }

        const chain = this.schema.mineForTypes(types || []);

        return components.find((c) => chain.indexOf(c) > 0);
    }

    /**
     * Resolves a renderer from the {lookupCache}.
     * @param key The key to look up.
     * @returns If saved the render component, otherwise undefined.
     */
    private getComponentFromCache(key: string): T | undefined {
        return this.lookupCache[key];
    }

    private possibleComponents(predicates: NamedNode[], topology: NamedNode): NamedNode[] {
        const classes = [defaultNS.rdfs("Resource")];
        for (const predicate of predicates) {
            if (typeof this.mapping[predicate.sI] !== "undefined") {
                const types = this.mapping[predicate.sI];
                types.forEach((_v, i) => {
                    const compType = this.lookup(predicate.sI, i, topology.sI);
                    if (compType !== undefined) {
                        classes.push(namedNodeByStoreIndex(i) as NamedNode);
                    }
                });
            }
        }

        return classes;
    }
}
