/* Taken, stripped and modified from rdflib.js */

import { LowLevelStore, QuadPosition } from "@ontologies/core";
import { Node, Term } from "@ontologies/core/dist-types/types";

import { NamedNode, Quad, SomeTerm } from "../rdf";
import { SomeNode, WildQuadruple } from "../types";
import BasicStore from "./BasicStore";

export type Constructable<T = object> = new (...args: any[]) => T;

export interface IndexedStore extends LowLevelStore {
    readonly quads: Quad[];
    readonly indices: Quad[][][];
    match(
        subj: Node | undefined | null,
        pred?: NamedNode | undefined | null,
        obj?: Term | undefined | null,
        why?: Node | undefined | null,
        justOne?: boolean,
    ): Quad[];
}

export interface CallbackStore {
    readonly dataCallbacks: Array<(quad: Quad) => void>;

    removeCallback: ((quad: Quad) => void) | undefined;
    addDataCallback(callback: (q: Quad) => void): void;
}

const quadParts: Array<keyof Quad> = [
    "subject",
    "predicate",
    "object",
    "graph",
];
enum SearchIndexPosition {
    Pattern = 0,
    Hash = 1,
    Given = 2,
}
type SearchIndex = [Array<SomeTerm | null>, number[], number[]];

function isCallbackStore(store: any): store is CallbackStore {
    return typeof store === "object" && store !== null && "dataCallbacks" in store;
}

function updateIndices(store: IndexedStore, q: Quad): void {
    const indices = store.indices.length;
    const hash = [
        store.rdfFactory.id(q.subject) as number,
        store.rdfFactory.id(q.predicate) as number,
        store.rdfFactory.id(q.object) as number,
        store.rdfFactory.id(q.graph) as number,
    ];

    for (let i = 0; i < indices; i++) {
        const ix = store.indices[i];
        const h = hash[i];
        if (!ix[h]) {
            ix[h] = [];
        }
        ix[h].push(q);
    }
}

function add(
    store: IndexedStore | (IndexedStore & CallbackStore),
    subject: SomeNode,
    predicate: NamedNode,
    object: SomeTerm,
    graph: SomeNode,
): Quad {
    const existing = store.match(subject, predicate, object, graph || null, true)[0];
    if (existing) {
        return existing;
    }

    const q = store.rdfFactory.quad(subject, predicate, object, graph as NamedNode);
    updateIndices(store, q);
    store.quads.push(q);

    if (isCallbackStore(store)) {
        for (const callback of store.dataCallbacks) {
            callback(q);
        }
    }

    return q;
}

function computeSearchIndices(store: IndexedStore, search: WildQuadruple): SearchIndex {
    const pat = [
        search[QuadPosition.subject],
        search[QuadPosition.predicate],
        search[QuadPosition.object],
        search[QuadPosition.graph],
    ];
    const pattern = [];
    const given = []; // Not wild
    const hash: number[] = [];

    for (let p = 0; p < 4; p++) {
        pattern[p] = pat[p];
        if (pattern[p] !== null) {
            given.push(p);
            hash[p] = store.rdfFactory.id(pattern[p]!) as number;
        }
    }

    return [pattern, hash, given];
}

function quadByIndex(store: IndexedStore, search: SearchIndex, justOne: boolean): Quad[] {
    const p = search[SearchIndexPosition.Given][0];
    let indexEntry = store.indices[p][search[SearchIndexPosition.Hash][p]];
    if (indexEntry && justOne) {
        if (indexEntry.length > 1) {
            indexEntry = indexEntry.slice(0, 1);
        }
    }

    return indexEntry || [];
}

function findShortestIndex(store: IndexedStore, search: SearchIndex): number|null {
    let best = 1e10; // really bad
    let bestIndex = 0;
    let list;
    const given = search[SearchIndexPosition.Given];

    for (let i = 0; i < given.length; i++) {
        const p = given[i];
        list = store.indices[p][search[SearchIndexPosition.Hash][p]];

        if (!list) {
            return null;
        }

        if (list.length < best) {
            best = list.length;
            bestIndex = i;
        }
    }

    return bestIndex;
}

function filterIndex(store: IndexedStore, search: SearchIndex, bestIndex: number, justOne: boolean): Quad[] {
    const [pattern, hash, given] = search;

    // Ok, we have picked the shortest index but now we have to filter it
    const pBest = given[bestIndex];
    const possibles = store.indices[pBest][hash[pBest]];
    const check = given.slice(0, bestIndex).concat(given.slice(bestIndex + 1)); // remove iBest
    const results = [];
    for (let j = 0; j < possibles.length; j++) {
        let st: Quad | null = possibles[j];

        for (let i = 0; i < check.length; i++) { // for each position to be checked
            const p = check[i];
            if (!store.rdfFactory.equals(st[quadParts[p]], pattern[p])) {
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

function match(store: IndexedStore, search: WildQuadruple, justOne: boolean): Quad[] {
    const parsedSearch = computeSearchIndices(store, search);

    if (parsedSearch[SearchIndexPosition.Given].length === 0) {
        return store.quads;
    }
    if (parsedSearch[SearchIndexPosition.Given].length === 1) { // Easy too, we have an index for that
        return quadByIndex(store, parsedSearch, justOne);
    }

    const bestStartIndex = findShortestIndex(store, parsedSearch);
    if (bestStartIndex === null) {
        return [];
    }

    return filterIndex(store, parsedSearch, bestStartIndex, justOne);
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
            return add(this, subject, predicate, object, graph);
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
            return match(this, [subject, predicate, object, graph], justOne);
        }
    };
}
