/* Taken, stripped and modified from rdflib.js */

import { DataFactory, LowLevelStore } from "@ontologies/core";

import { NamedNode, Quad, SomeTerm } from "../rdf";
import { SomeNode } from "../types";

import BasicStore from "./BasicStore";
import { Equatable } from "./Equatable";
import { Indexable } from "./Indexable";

export interface IndexedFormulaOpts {
    quads: Quad[];
    dataCallback: (quad: Quad) => void;
    rdfFactory: DataFactory;
}

export type PropertyActionCallback = (quad: Quad) => void;

/** Query and modify an array of quads. */
export default class RDFIndex extends Equatable(Indexable(BasicStore)) implements LowLevelStore {
    private readonly propertyActions: PropertyActionCallback[][] = [];

    /**
     * @constructor
     * @param opts
     * @param {DataFactory} [opts.dataCallback] - Callback when a new quad is added to the store
     */
    constructor(opts: Partial<IndexedFormulaOpts> = {}) {
        super(opts);
    }

    public any(
        subject: SomeNode | null,
        predicate: NamedNode | null,
        object: SomeTerm | null,
        graph: SomeNode | null,
    ): SomeTerm | undefined {
        const st = this.anyQuadMatching(subject, predicate, object, graph);

        if (st === undefined) {
            return undefined;
        } else if (subject === null) {
            return st.subject;
        } else if (predicate === null) {
            return st.predicate;
        } else if (object === null) {
            return st.object;
        } else if (graph === null) {
            return st.graph;
        }

        return undefined;
    }

    public anyQuadMatching(
        subject: SomeNode | null,
        predicate: NamedNode | null,
        object: SomeTerm | null,
        graph: SomeNode | null,
    ): Quad | undefined {
        return this.match(subject, predicate, object, graph, true)?.[0];
    }

    /**
     * Returns the number of quads contained in this IndexedFormula.
     * (Getter proxy to this.quads).
     * Usage:
     *    ```
     *    const kb = rdf.graph()
     *    kb.length  // -> 0
     *    ```
     * @returns {Number}
     */
    public get length(): number {
        return this.quads.length;
    }

    public holds(s: SomeNode, p: NamedNode, o: SomeTerm, g: SomeNode): boolean {
        return this.match(s, p, o, g, true)?.[0] !== undefined;
    }

    public holdsAll(quads: Quad[]): boolean {
        return quads.every((q) => this.holds(q.subject, q.predicate, q.object, q.graph));
    }

    public holdsQuad(quad: Quad): boolean {
        return this.holds(quad.subject, quad.predicate, quad.object, quad.graph);
    }

    public newPropertyAction(predicate: NamedNode, action: PropertyActionCallback): void {
        const hash = this.rdfFactory.id(predicate) as number;
        if (!this.propertyActions[hash]) {
            this.propertyActions[hash] = [];
        }
        this.propertyActions[hash].push(action);
        const toBeFixed = this.match(null, predicate, null, null);
        for (let i = 0; i < toBeFixed.length; i++) {
            action(toBeFixed[i]);
        }
    }

    public removeMatches(
        subject: SomeNode | null,
        predicate: NamedNode | null,
        object: SomeTerm | null,
        graph: SomeNode | null,
    ): this {
        this.removeQuads(this.match(
            subject,
            predicate,
            object,
            graph,
        ));

        return this;
    }
}
