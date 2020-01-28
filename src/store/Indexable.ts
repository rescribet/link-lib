/* Taken, stripped and modified from rdflib.js */

import {
    HexPos,
    Hextuple,
    JSLitDatatype,
    JSLitLang,
    JSLitValue,
    JSNamedNode,
    JSResource,
    LowLevelStore,
    Node,
    Term,
} from "@ontologies/core";

import { NamedNode, Quad, SomeTerm } from "../rdf";
import { SomeNode, WildHextuple } from "../types";
import { hexToQuad, objectToHexObj, quadToHex } from "../utilities/hex";
import BasicStore, { InternalHextuple } from "./BasicStore";

export type Constructable<T = object> = new (...args: any[]) => T;

export interface IndexedStore extends LowLevelStore {
    readonly quads: Hextuple[];
    readonly indices: Array<{[k: string]: Hextuple[]}>;
    canon<T = Term>(t: T): T;
    match(
        subj: Node | undefined | null,
        pred?: NamedNode | undefined | null,
        obj?: Term | undefined | null,
        why?: Node | undefined | null,
        justOne?: boolean,
    ): Quad[];
    matchHex(
        subject: JSResource,
        predicate: JSNamedNode,
        object: JSLitValue,
        datatype: JSLitDatatype | null,
        lang: JSLitLang | null,
        graph: JSResource | null,
        justOne?: boolean,
    ): Hextuple[];
}

export interface CallbackStore {
    readonly dataCallbacks: Array<(quad: Hextuple) => void>;

    removeCallback: ((quad: Hextuple) => void) | undefined;
    addDataCallback(callback: (q: Hextuple) => void): void;
}

enum SearchIndexPosition {
    Pattern = 0,
    Hash = 1,
    Given = 2,
}
type SearchIndex = [Array<SomeTerm | null>, string[], number[]];

function isCallbackStore(store: any): store is CallbackStore {
    return typeof store === "object" && store !== null && "dataCallbacks" in store;
}

function updateIndices(store: IndexedStore, q: Hextuple): void {
    const indices = store.indices.length;
    const hash = [
        store.canon(q[HexPos.subject]),
        store.canon(q[HexPos.predicate]),
        store.canon(q[HexPos.object]),
        store.canon(q[HexPos.graph]),
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
    subject: JSResource,
    predicate: JSNamedNode,
    objectV: JSLitValue,
    objectDt: JSLitDatatype,
    objectL: JSLitLang,
    graph: JSResource,
): Hextuple {
    const existing = store.matchHex(subject, predicate, objectV, objectDt, objectL, graph || null, true)[0];
    if (existing) {
        return existing;
    }

    const h: Hextuple = [subject, predicate, objectV, objectDt, objectL, graph];
    updateIndices(store, h);
    store.quads.push(h);

    if (isCallbackStore(store)) {
        for (const callback of store.dataCallbacks) {
            callback(h);
        }
    }

    return h;
}

function computeSearchIndices(search: WildHextuple): SearchIndex {
    const pat = [
        search[HexPos.subject],
        search[HexPos.predicate],
        search[HexPos.object],
        search[HexPos.objectDT],
        search[HexPos.objectLang],
        search[HexPos.graph],
    ];
    const pattern = [];
    const given = []; // Not wild
    const hash = [];

    for (let p = 0; p < 4; p++) {
        pattern[p] = pat[p];
        if (pattern[p] !== null) {
            given.push(p);
            hash[p] = pattern[p]!;
        }
    }

    return [pattern, hash, given];
}

function hexByIndex(store: IndexedStore, search: SearchIndex, _: boolean): Hextuple[] {
    const p = search[SearchIndexPosition.Given][0];
    const indexEntry = (store.indices[p][search[SearchIndexPosition.Hash][p]] as unknown as InternalHextuple[]);

    if (!indexEntry) {
        return [];
    }

    const res = [];
    for (let i = 0; i < indexEntry.length; i++) {
        if (!indexEntry[i][HexPos.graph + 1]) {
            res.push(indexEntry[i]);
        }
    }

    return indexEntry as unknown as Hextuple[];
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

function filterIndex(
    store: IndexedStore,
    search: SearchIndex,
    bestIndex: number,
    justOne: boolean,
): Hextuple[] {
    const [pattern, hash, given] = search;

    // Ok, we have picked the shortest index but now we have to filter it
    const pBest = given[bestIndex];
    const possibles = store.indices[pBest][hash[pBest]] as unknown as InternalHextuple[];
    const check = [...given.slice(0, bestIndex), ...given.slice(bestIndex + 1)]; // remove iBest
    const results = [];
    const canons = (store as any).redirections;
    for (let j = 0; j < possibles.length; j++) {
        let st: InternalHextuple | null = possibles[j];

        for (let i = 0; i < check.length; i++) { // for each position to be checked
            const p = check[i];
            if ((canons.get(st[p] as string) || st[p]) !== pattern[p]) {
                st = null;
                break;
            }
        }
        if (st !== null && !st[6]) {
            results.push(st);
            if (justOne) { break; }
        }
    }

    return results as unknown as Hextuple[];
}

export function match(store: IndexedStore, search: WildHextuple, justOne: boolean): Hextuple[] {
    const parsedSearch = computeSearchIndices(search);

    if (parsedSearch[SearchIndexPosition.Given].length === 0) {
        return (store.quads as unknown as InternalHextuple[])
            .filter(([, , , , , , del]) => !del) as unknown as Hextuple[];
    }
    if (parsedSearch[SearchIndexPosition.Given].length === 1) { // Easy too, we have an index for that
        return hexByIndex(store, parsedSearch, justOne);
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
        public indices: Array<{ [k: string]: Hextuple[] }>;

        public subjectIndex: { [k: string]: Hextuple[] } = {};
        public predicateIndex: { [k: string]: Hextuple[] } = {};
        public objectIndex: { [k: string]: Hextuple[] } = {};
        public graphIndex: { [k: string]: Hextuple[] } = {};

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
            const [v, dt, l] = objectToHexObj(object);
            return hexToQuad(add(this, subject, predicate, v, dt, l, graph));
        }

        public addH(
            subject: JSResource,
            predicate: JSNamedNode,
            object: JSLitValue,
            dt: JSLitDatatype,
            lang: JSLitLang,
            graph: JSResource = this.rdfFactory.defaultGraph(),
        ): Hextuple {
            return add(this, subject, predicate, object, dt, lang, graph);
        }

        public canon<T = Term>(term: T): T {
            return term;
        }

        /**
         * Remove a particular quad object from the store
         *
         * st    a quad which is already in the store and indexed.
         *      Make sure you only use this for these.
         *    Otherwise, you should use remove() above.
         */
        public removeQuad(quad: Quad): this {
            const term = [ quad.subject, quad.predicate, objectToHexObj(quad.object)[0], quad.graph ];
            const hex = quadToHex(quad);
            for (let p = 0; p < 4; p++) {
                const h = this.canon(term[p]);
                if (this.indices[p][h]) {
                    this.rdfArrayRemove(this.indices[p][h], hex);
                }
            }
            if (this.removeCallback) {
                this.removeCallback(hex);
            }
            this.rdfArrayRemove(this.quads, hex);
            return this;
        }

        // public removeHex(hex: Hextuple): this {
        //     const term = [ hex[HexPos.subject], hex[HexPos.predicate], hex[HexPos.object], hex[HexPos.graph] ];
        //     for (let p = 0; p < 4; p++) {
        //         const h = this.canon(term[p]);
        //         if (this.indices[p][h]) {
        //             this.rdfArrayRemove(this.indices[p][h], hex);
        //         }
        //     }
        //     if (this.removeCallback) {
        //         this.removeCallback(hex);
        //     }
        //     this.rdfArrayRemove(this.quads, hex);
        //     return this;
        // }

        public removeHex(hex: Hextuple): this {
            if (!this.cleanTimeout && typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
                this.cleanTimeout = window.requestIdleCallback(this.cleanIndices, { timeout: 10000 });
            }

            (hex as unknown as InternalHextuple)[HexPos.graph + 1] = true;
            if (this.removeCallback) {
                this.removeCallback(hex);
            }
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
            return match(
                this,
                [subject, predicate, ...objectToHexObj(object!), graph] as WildHextuple,
                justOne,
            ).map(hexToQuad);
        }

        public matchHex(
            subject: string | null,
            predicate: string | null,
            object: string | null,
            datatype: string | null,
            lang: string | null,
            graph: string | null,
            justOne: boolean = false,
        ): Hextuple[] {
            return match(this, [subject, predicate, object, datatype, lang, graph], justOne);
        }

        /** @ignore */
        public cleanIndices(): void {
            const next = [];
            const subjectIndex: { [k: string]: Hextuple[] } = {};
            const predicateIndex: { [k: string]: Hextuple[] } = {};
            const objectIndex: { [k: string]: Hextuple[] } = {};
            const graphIndex: { [k: string]: Hextuple[] } = {};
            let q;
            const length = this.quads.length;
            for (let i = 0; i < length; i++) {
                q = this.quads[i];
                if (!q[HexPos.graph + 1]) {
                    next.push(q);

                    const sCanon = this.canon(q[HexPos.subject]);
                    if (subjectIndex[sCanon]) {
                        subjectIndex[sCanon].push(q);
                    } else {
                        subjectIndex[sCanon] = [q];
                    }

                    const pCanon = this.canon(q[HexPos.predicate]);
                    if (predicateIndex[pCanon]) {
                        predicateIndex[pCanon].push(q);
                    } else {
                        predicateIndex[pCanon] = [q];
                    }

                    const oCanon = this.canon(q[HexPos.object]);
                    if (objectIndex[oCanon]) {
                        objectIndex[oCanon].push(q);
                    } else {
                        objectIndex[oCanon] = [q];
                    }

                    const gCanon = this.canon(q[HexPos.graph]);
                    if (graphIndex[gCanon]) {
                        graphIndex[gCanon].push(q);
                    } else {
                        graphIndex[gCanon] = [q];
                    }
                }
            }
            this.quads = next;
            this.subjectIndex = subjectIndex;
            this.predicateIndex = predicateIndex;
            this.objectIndex = objectIndex;
            this.graphIndex = graphIndex;
            this.indices = [
                this.subjectIndex,
                this.predicateIndex,
                this.objectIndex,
                this.graphIndex,
            ];

            this.cleanTimeout = undefined;
        }
    };
}
