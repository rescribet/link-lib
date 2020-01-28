/* Parts taken, stripped and modified from rdflib.js */

import rdfFactory, { DataFactory, Feature, LowLevelStore, QuadPosition } from "@ontologies/core";

import { NamedNode, Quad, Quadruple, SomeTerm } from "../rdf";
import { SomeNode } from "../types";

export interface IndexedFormulaOpts {
    quads: Quad[];
    dataCallback: (quad: Quad) => void;
    rdfFactory: DataFactory;
}

/** Query and modify an array of quads. */
export default class BasicStore implements LowLevelStore {
    public readonly rdfFactory: DataFactory;

    public readonly quads: Quad[] = [];
    public readonly dataCallbacks: Array<(quad: Quad) => void>;
    public readonly removeCallback: ((quad: Quad) => void) | undefined;

    constructor(opts: Partial<IndexedFormulaOpts> = {}) {
        this.dataCallbacks = [];
        this.quads = opts.quads || [];
        this.rdfFactory = opts.rdfFactory || rdfFactory;
        this.rdfArrayRemove = this.rdfFactory.supports?.[Feature.identity]
            ? this.identityRemove
            : this.searchRemove;
    }

    /** Add a quad to the store. */
    public add(
        subject: SomeNode,
        predicate: NamedNode,
        object: SomeTerm,
        graph: SomeNode = this.rdfFactory.defaultGraph(),
    ): Quad {
        const existing = this.match(subject, predicate, object, graph || null, true)[0];
        if (existing) {
            return existing;
        }

        const st = this.rdfFactory.quad(subject, predicate, object, graph as NamedNode);
        this.quads.push(st);

        if (this.dataCallbacks) {
            for (const callback of this.dataCallbacks) {
                callback(st);
            }
        }

        return st;
    }

    public addQuad(quad: Quad): Quad {
        return this.add(quad.subject, quad.predicate, quad.object, quad.graph);
    }

    public addQuads(quads: Quad[]): Quad[] {
        return quads.map((quad) => this.add(quad.subject, quad.predicate, quad.object, quad.graph));
    }

    public addQuadruple(qdr: Quadruple): Quadruple {
        const quad = this.add(
            qdr[QuadPosition.subject],
            qdr[QuadPosition.predicate],
            qdr[QuadPosition.object],
            qdr[QuadPosition.graph],
        );
        return [quad.subject, quad.predicate, quad.object, quad.graph];
    }

    public addQuadruples(qdrs: Quadruple[]): Quadruple[] {
        return qdrs.map((qdr) => this.addQuadruple(qdr));
    }

    public addDataCallback(callback: (q: Quad) => void): void {
        this.dataCallbacks.push(callback);
    }

    /** Returns the number of quads in the store. */
    public get length(): number {
        return this.quads.length;
    }

    /** Remove a quad from the store */
    public remove(st: Quad): this {
        const sts = this.match(
            st.subject,
            st.predicate,
            st.object,
            st.graph,
        );
        if (!sts.length) {
            throw new Error(`Quad to be removed is not on store: ${st}`);
        }
        this.removeQuad(sts[0]);

        return this;
    }

    /** Remove a quad from the store */
    public removeQuad(quad: Quad): this {
        this.rdfArrayRemove(this.quads, quad);
        if (this.removeCallback) {
            this.removeCallback(quad);
        }
        return this;
    }

    public removeQuads(quads: Quad[]): this {
        // Ensure we don't loop over the array we're modifying.
        const toRemove = quads.slice();
        for (let i = 0; i < toRemove.length; i++) {
            this.remove(toRemove[i]);
        }
        return this;
    }

    /** Search the Store */
    public match(
        subject: SomeNode | null,
        predicate: NamedNode | null,
        object: SomeTerm | null,
        graph: SomeNode | null,
        justOne: boolean = false,
    ): Quad[] {
        const factory = this.rdfFactory;
        const filter = (q: Quad): boolean =>
            (subject === null || factory.equals(q.subject, subject))
            && (predicate === null || factory.equals(q.predicate, predicate))
            && (object === null || factory.equals(q.object, object))
            && (graph === null || factory.equals(q.graph, graph));

        if (justOne) {
            const res = this.quads.find(filter);
            return res ? [res] : [];
        }

        return this.quads.filter(filter);
    }

    // tslint:disable-next-line:no-empty
    public rdfArrayRemove(_arr: Quad[], _quad: Quad): void {}

    public identityRemove(arr: Quad[], quad: Quad): void {
        arr[arr.indexOf(quad)] = arr[arr.length - 1];
        arr.pop();
    }

    public searchRemove(arr: Quad[], quad: Quad): void {
        const factory = this.rdfFactory;
        const index = arr.findIndex((q: Quad) => factory.equals(quad, q));
        arr.splice(index, 1);
    }
}
