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
import { RDFAdapter, RDFAdapterOpts } from "./RDFAdapter";
import { DataRecord, Id } from "./StructuredStore";

export interface IndexedFormulaOpts extends RDFAdapterOpts {
    data?: Record<Id, DataRecord>;
    quads: Quadruple[];
    dataCallback: (quad: Quadruple) => void;
    rdfFactory: DataFactory;
}

export type PropertyActionCallback = (record: DataRecord) => void;

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

    public references(recordId: SomeNode): Id[] {
        const references = [];
        const data = this.store.data;
        for (const rId in data) {
            if (!data.hasOwnProperty(rId)) {
                continue;
            }

            const record = data[rId];
            for (const field in record) {
                if (!record.hasOwnProperty(field)) {
                    continue;
                }

                const values = record[field];
                if (Array.isArray(values)) {
                    for (const value of values) {
                        if (value === recordId) {
                            references.push(rId);
                        }
                    }
                } else {
                    if (values === recordId) {
                        references.push(rId);
                    }
                }
            }
        }

        return references;
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
        const data = this.store.data;
        for (const recordId in data) {
            if (!data.hasOwnProperty(recordId)) {
                continue;
            }
            const record = this.store.getRecord(recordId);
            if (record?.[predicate.value] !== undefined) {
                action(record);
            }
        }
    }
}
