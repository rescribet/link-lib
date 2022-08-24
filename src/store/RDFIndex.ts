/* Taken, stripped and modified from rdflib.js */

import { DataFactory, Quadruple } from "@ontologies/core";

import { SomeNode } from "../types";

import { Equatable } from "./Equatable";
import { RDFAdapter, RDFAdapterOpts } from "./RDFAdapter";
import { DataRecord, Id } from "./types";

export interface IndexedFormulaOpts extends RDFAdapterOpts {
    data?: Record<Id, DataRecord>;
    quads: Quadruple[];
    dataCallback: (quad: Quadruple) => void;
    rdfFactory: DataFactory;
}

/** Query and modify an array of quads. */
export default class RDFIndex extends Equatable(RDFAdapter) {
    /** Returns the number of quads in the store. */
    public length: number = 0;

    /**
     * @constructor
     * @param opts
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
}
