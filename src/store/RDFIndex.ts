/* Taken, stripped and modified from rdflib.js */

import { DataFactory, LowLevelStore } from "@ontologies/core";

import { id } from "../factoryHelpers";
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
    /** Returns the number of quads in the store. */
    public length: number = 0;

    private readonly propertyActions: PropertyActionCallback[][] = [];

    /**
     * @constructor
     * @param opts
     * @param {DataFactory} [opts.dataCallback] - Callback when a new quad is added to the store
     */
    constructor(opts: Partial<IndexedFormulaOpts> = {}) {
        super(opts);

        this.addDataCallback(this.processPropertyAction.bind(this));

        Object.defineProperty(this, "length", {
            get(): number {
                return this.quads.length;
            },
            set(value: number): void {
                this.quads.length = value;
            },
        });
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
        const hash = id(predicate) as number;
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

    private processPropertyAction(quad: Quad): void {
        const actions = this.propertyActions[id(quad.predicate)];
        if (actions?.length > 0) {
            actions.forEach((action) => action(quad));
        }
    }
}
