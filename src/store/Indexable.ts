/* Taken, stripped and modified from rdflib.js */

import { LowLevelStore } from "@ontologies/core";

import { NamedNode, Quad, SomeTerm } from "../rdf";
import { SomeNode } from "../types";
import BasicStore from "./BasicStore";

export type Constructable<T = object> = new (...args: any[]) => T;

export interface IndexedStore extends LowLevelStore {
    readonly indices: Quad[][][];
}

// tslint:disable-next-line:typedef
export function Indexable<BC extends Constructable<BasicStore>>(base: BC) {
    return class extends base implements IndexedStore {
        public readonly indices: Quad[][][];

        public readonly subjectIndex: Quad[][] = [];
        public readonly predicateIndex: Quad[][] = [];
        public readonly objectIndex: Quad[][] = [];
        public readonly graphIndex: Quad[][] = [];

        constructor(...args: any[]) {
            super(...args);

            this.indices = [
                this.subjectIndex,
                this.predicateIndex,
                this.objectIndex,
                this.graphIndex,
            ];
        }

        /**
         * Adds a triple (quad) to the store.
         *
         * @param {Term} subject - The thing about which the fact a relationship is asserted
         * @param {namedNode} predicate - The relationship which is asserted
         * @param {Term} object - The object of the relationship, e.g. another thing or avalue
         * @param {namedNode} graph - The document in which the triple (S,P,O) was or will be stored on the web
         * @returns {Quad} The quad added to the store
         */
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

            const predHash = this.rdfFactory.id(predicate) as number;
            const st = this.rdfFactory.quad(subject, predicate, object, graph as NamedNode);

            const hash = [
                this.rdfFactory.id(subject) as number,
                predHash,
                this.rdfFactory.id(object) as number,
                this.rdfFactory.id(graph) as number,
            ];
            const indices = this.indices.length;
            for (let i = 0; i < indices; i++) {
                const ix = this.indices[i];
                const h = hash[i];
                if (!ix[h]) {
                    ix[h] = [];
                }
                ix[h].push(st);
            }

            this.quads.push(st);

            if (this.dataCallbacks) {
                for (const callback of this.dataCallbacks) {
                    callback(st);
                }
            }

            return st;
        }

        /**
         * Remove a particular quad object from the store
         *
         * st    a quad which is already in the store and indexed.
         *      Make sure you only use this for these.
         *    Otherwise, you should use remove() above.
         */
        public removeQuad(quad: Quad): this {
            const term = [ quad.subject, quad.predicate, quad.object, quad.graph ];
            for (let p = 0; p < 4; p++) {
                const h = this.rdfFactory.id(term[p]) as number;
                if (this.indices[p][h]) {
                    this.rdfArrayRemove(this.indices[p][h], quad);
                }
            }
            if (this.removeCallback) {
                this.removeCallback(quad);
            }
            this.rdfArrayRemove(this.quads, quad);
            return this;
        }

        /**
         * Search the Store
         *
         * ALL CONVENIENCE LOOKUP FUNCTIONS RELY ON THIS!
         * @param {Node} subject - A node to search for as subject, or if null, a wildcard
         * @param {Node} predicate - A node to search for as predicate, or if null, a wildcard
         * @param {Node} object - A node to search for as object, or if null, a wildcard
         * @param {Node} graph - A node to search for as graph, or if null, a wildcard
         * @param {Boolean} justOne - flag - stop when found one rather than get all of them?
         * @returns {Array<Node>} - An array of nodes which match the wildcard position
         */
        public match(
            subject: SomeNode | null,
            predicate: NamedNode | null,
            object: SomeTerm | null,
            graph: SomeNode | null,
            justOne: boolean = false,
        ): Quad[] {
            const pat = [ subject, predicate, object, graph ];
            const pattern = [];
            const hash: number[] = [];
            const given = []; // Not wild
            let p;
            let list;
            for (p = 0; p < 4; p++) {
                pattern[p] = pat[p];
                if (pattern[p] !== null) {
                    given.push(p);
                    hash[p] = this.rdfFactory.id(pattern[p]!) as number;
                }
            }
            if (given.length === 0) {
                return this.quads;
            }
            if (given.length === 1) { // Easy too, we have an index for that
                p = given[0];
                list = this.indices[p][hash[p]];
                if (list && justOne) {
                    if (list.length > 1) {
                        list = list.slice(0, 1);
                    }
                }
                list = list || [];

                return list;
            }
            // Now given.length is 2, 3 or 4.
            // We hope that the scale-free nature of the data will mean we tend to get
            // a short index in there somewhere!
            let best = 1e10; // really bad
            let bestIndex = 0;
            for (let i = 0; i < given.length; i++) {
                p = given[i];
                list = this.indices[p][hash[p]];
                if (!list) {
                    return [];
                }
                if (list.length < best) {
                    best = list.length;
                    bestIndex = i;
                }
            }
            // Ok, we have picked the shortest index but now we have to filter it
            const pBest = given[bestIndex];
            const possibles = this.indices[pBest][hash[pBest]];
            const check = given.slice(0, bestIndex).concat(given.slice(bestIndex + 1)); // remove iBest
            const results = [];
            const parts: Array<keyof Quad> = [
                "subject",
                "predicate",
                "object",
                "graph",
            ];
            for (let j = 0; j < possibles.length; j++) {
                let st: Quad | null = possibles[j];

                for (let i = 0; i < check.length; i++) { // for each position to be checked
                    p = check[i];
                    if (!this.rdfFactory.equals(st[parts[p]], pattern[p])) {
                        st = null;
                        break;
                    }
                }
                if (st != null) {
                    results.push(st);
                    if (justOne) { break; }
                }
            }

            return results;
        }
    };
}
