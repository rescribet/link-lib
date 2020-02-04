/* Parts taken, stripped and modified from rdflib.js */

import rdfFactory, {
    DataFactory,
    HexPos,
    Hextuple,
    JSLitDatatype,
    JSLitLang,
    JSLitValue,
    JSNamedNode,
    JSResource,
    LowLevelStore,
    QuadPosition,
    SomeTerm,
} from "@ontologies/core";

import { NamedNode, Quad, Quadruple } from "../rdf";
import { SomeNode, WildHextuple } from "../types";
import { hexToQuad, objectToHexObj, quadToHex } from "../utilities/hex";

export interface IndexedFormulaOpts {
    quads: Hextuple[];
    dataCallback: (quad: Hextuple) => void;
    rdfFactory: DataFactory;
}

type HexSearch = [
    JSResource | null,
    JSNamedNode | null,
    JSLitValue | null,
    JSLitDatatype | null,
    JSLitLang | null,
    JSResource | null,
];

function hexEquals(a: Hextuple, b: Hextuple): boolean {
    return a[0] === b[0]
        && a[1] === b[1]
        && a[2] === b[2]
        && a[3] === b[3]
        && a[4] === b[4]
        && a[5] === b[5];
}

// function indexRemove(arr: Hextuple[], quad: Hextuple): void {
//     arr[arr.indexOf(quad)] = arr[arr.length - 1];
//     arr.pop();
// }

// function findRemove(arr: Hextuple[], quad: Hextuple): void {
//     const index = arr.findIndex((q: Hextuple) => hexEquals(quad, q));
//     arr[index] = arr[arr.length - 1];
//     arr.pop();
// }

export type InternalHextuple = [
    string,
    string,
    string,
    string,
    string,
    string,
    boolean,
];

/** Query and modify an array of quads. */
export default class BasicStore implements LowLevelStore {
    public readonly rdfFactory: DataFactory;

    public quads: Hextuple[] = [];
    public readonly dataCallbacks: Array<(quad: Hextuple) => void>;
    public readonly removeCallback: ((quad: Hextuple) => void) | undefined;
    public cleanTimeout: number | undefined;

    constructor(opts: Partial<IndexedFormulaOpts> = {}) {
        this.dataCallbacks = [];
        this.quads = opts.quads || [];
        this.rdfFactory = opts.rdfFactory || rdfFactory;
        // this.rdfArrayRemove = this.rdfFactory?.supports[Feature.identity]
        //     ? indexRemove
        //     : findRemove;
        // this.rdfArrayRemove = findRemove;
        this.cleanIndices = this.cleanIndices.bind(this);
    }

    public rdfArrayRemove(arr: Hextuple[], quad: Hextuple): void {
        const index = arr.findIndex((q: Hextuple) => hexEquals(quad, q));
        arr[index] = arr[arr.length - 1];
        arr.pop();
    }

    /** Add a quad to the store. */
    public add(
        subject: SomeNode,
        predicate: NamedNode,
        object: SomeTerm,
        graph: SomeNode = this.rdfFactory.defaultGraph(),
    ): Quad {
        const [oV, oDt, oL] = objectToHexObj(object);

        return hexToQuad(this.addH(subject, predicate, oV, oDt, oL, graph));
    }

    /** Add a quad to the store. */
    public addH(
        subject: JSResource,
        predicate: JSNamedNode,
        object: JSLitValue,
        dt: JSLitDatatype,
        lang: JSLitLang,
        graph: JSResource = this.rdfFactory.defaultGraph(),
    ): Hextuple {
        const existing = this.matchHex(subject, predicate, object, dt, lang, graph || null, true)[0];
        if (existing) {
            return existing;
        }

        const st: Hextuple = {
            0: subject,
            1: predicate,
            2: object,
            3: dt,
            4: lang,
            5: graph,
            statementDeleted: false,
        } as unknown as Hextuple;
        this.quads.push(st);

        if (this.dataCallbacks) {
            for (const callback of this.dataCallbacks) {
                callback(st);
            }
        }

        return st;
    }

    public addHextuple(qdrs: Hextuple[]): Hextuple[] {
        return qdrs.map((qdr) => this.addHex(qdr));
    }

    public addHextuples(qdrs: Hextuple[]): Hextuple[] {
        return qdrs.map((qdr) => this.addHex(qdr));
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

    public addDataCallback(callback: (q: Hextuple) => void): void {
        this.dataCallbacks.push(callback);
    }

    /** Returns the number of quads in the store. */
    public get length(): number {
        return this.quads.length;
    }

    /** Remove a quad from the store */
    public remove(st: Quad): this {
        const hex = [
            st.subject,
            st.predicate,
            ...objectToHexObj(st.object),
            st.graph,
        ] as Hextuple;
        const sts = this.matchHextuple(hex);
        if (!sts.length) {
            throw new Error(`Quad to be removed is not on store: ${st}`);
        }
        this.removeHex(sts[0]);

        return this;
    }

    /** Remove a quad from the store */
    public removeQuad(quad: Quad): this {
        return this.removeHex(quadToHex(quad));
    }

    public removeQuads(quads: Quad[]): this {
        return this.removeHexes(quads.map(quadToHex));
    }

    /** Remove a quad from the store */
    public removeHex(quad: Hextuple): this {
        if (!this.cleanTimeout && typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
            this.cleanTimeout = window.requestIdleCallback(this.cleanIndices, { timeout: 10000 });
        }
        // this.rdfArrayRemove(this.quads, quad);
        (quad as any).statementDeleted = true;
        // (quad as unknown as InternalHextuple)[HexPos.graph + 1] = true;
        if (this.removeCallback) {
            this.removeCallback(quad);
        }
        return this;
    }

    /**
     * Removes existing hextuples from the store
     * @param quads
     */
    public removeHexes(quads: Hextuple[]): this {
        // TODO: move to RDFIndex?
        // const toRemove = [];
        // const len = quads.length;
        // for (let i = 0; i < len; i++) {
        //     const [firstMatch] = this.matchHextuple(quads[i]);
        //     if (firstMatch) {
        //         toRemove.push(firstMatch);
        //     }
        // }
        for (let i = 0; i < quads.length; i++) {
            this.removeHex(quads[i]);
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
    ): Hextuple[] {
        const hex = [
            subject || null,
            predicate || null,
            ...objectToHexObj(object!),
            graph || null,
        ] as HexSearch;

        return this.matchHex(hex[0], hex[1], hex[2], hex[3], hex[4], hex[5], justOne);
    }

    public addHex(hex: Hextuple): Hextuple {
        return this.addH(hex[0], hex[1], hex[2], hex[3], hex[4], hex[5]);
    }

    public addHexes(hex: Hextuple[]): Hextuple[] {
        return hex.map((h) => this.addHex(h));
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
        const filter = (h: Hextuple): boolean =>
            (subject === null || h[HexPos.subject] === subject)
            && (predicate === null || h[HexPos.predicate] === predicate)
            && (object === null || h[HexPos.object] === object)
            && (datatype === null || h[HexPos.objectDT] === datatype)
            && (lang === null || h[HexPos.objectLang] === lang)
            && (graph === null || h[HexPos.graph] === graph
            && (h as any).statementDeleted !== true);

        if (justOne) {
            const res = this.quads.find(filter);
            return res ? [res] : [];
        }

        return this.quads.filter(filter);
    }

    public matchHextuple(
        hextuple: WildHextuple,
        justOne: boolean = false,
    ): Hextuple[] {
        const filter = (h: Hextuple): boolean =>
            (hextuple[HexPos.subject] === null || h[HexPos.subject] === hextuple[HexPos.subject])
            && (hextuple[HexPos.predicate] === null || h[HexPos.predicate] === hextuple[HexPos.predicate])
            && (hextuple[HexPos.object] === null || h[HexPos.object] === hextuple[HexPos.object])
            && (hextuple[HexPos.objectDT] === null || h[HexPos.objectDT] === hextuple[HexPos.objectDT])
            && (hextuple[HexPos.objectLang] === null || h[HexPos.objectLang] === hextuple[HexPos.objectLang])
            && (hextuple[HexPos.graph] === null || h[HexPos.graph] === hextuple[HexPos.graph]
            && (h as any).statementDeleted !== true);

        if (justOne) {
            const res = this.quads.find(filter);
            return res ? [res] : [];
        }

        return this.quads.filter(filter);
    }

    /** @ignore */
    public cleanIndices(): void {
        const next = [];
        for (let i = 0; i < this.quads.length; i++) {
            if ((this.quads[i] as any).statementDeleted === true) {
                continue;
            }
            next.push(this.quads[i]);
        }
        this.quads = next;

        this.cleanTimeout = undefined;
    }
}
