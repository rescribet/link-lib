/* Taken, stripped and modified from rdflib.js */

import {
    DataFactory,
    NamedNode,
    Quadruple,
    SomeTerm,
} from "@ontologies/core";

import { id } from "../factoryHelpers";
import { SomeNode } from "../types";

import { Equatable } from "./Equatable";
import { RDFAdapter } from "./RDFAdapter";

export interface IndexedFormulaOpts {
    quads: Quadruple[];
    dataCallback: (quad: Quadruple) => void;
    rdfFactory: DataFactory;
}

export type PropertyActionCallback = (quad: Quadruple) => void;

/** Query and modify an array of quads. */
export default class RDFIndex extends Equatable(RDFAdapter) {
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

        Object.defineProperty(this, "length", {
            get(): number {
                return this.quads.length;
            },
            set(value: number): void {
                this.quads.length = value;
            },
        });
    }

    public holds(s: SomeNode, p: NamedNode, o: SomeTerm): boolean {
        return this.match(s, p, o, true)?.[0] !== undefined;
    }

    public newPropertyAction(predicate: NamedNode, action: PropertyActionCallback): void {
        const hash = id(predicate) as number;
        if (!this.propertyActions[hash]) {
            this.propertyActions[hash] = [];
        }
        this.propertyActions[hash].push(action);
        const toBeFixed = this.match(null, predicate, null);
        for (let i = 0; i < toBeFixed.length; i++) {
            action(toBeFixed[i]);
        }
    }
}
