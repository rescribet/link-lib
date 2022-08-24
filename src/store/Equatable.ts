/* Taken, stripped and modified from rdflib.js */

import {
    isNode,
    NamedNode,
    Node,
    Quadruple,
    SomeTerm,
} from "@ontologies/core";
import { sameAs } from "@ontologies/owl";

import { SomeNode } from "../types";

import { RDFAdapter } from "./RDFAdapter";
import { StructuredStore } from "./StructuredStore";
import { Id } from "./types";

export type Constructable<T = object> = new (...args: any[]) => T;

// tslint:disable-next-line:typedef
export function Equatable<BC extends Constructable<RDFAdapter>>(base: BC) {
    return class extends base {
        /** @private */
        public defaultGraphValue: string;

        public constructor(...args: any[]) {
            super(...args);
            this.defaultGraphValue = this.rdfFactory.defaultGraph().value;

            this.addRecordCallback((recordId: Id) => {
                const record = this.store.getRecord(recordId);
                if (record === undefined) {
                    return;
                }
                const sameAsValue = record[sameAs.value];
                if (sameAsValue) {
                    this.store.setAlias(
                      record._id.value,
                      (Array.isArray(sameAsValue) ? sameAsValue[0] : sameAsValue).value,
                    );
                }
            });
        }

        /** @private */
        public get defaultGraph(): StructuredStore {
            return this.store;
        }
        /** @private */
        public set defaultGraph(value: StructuredStore) {
            this.store = value;
        }

        public id(x: Node): number {
            return this.rdfFactory.id(x) as number;
        }

        public match(
            subject: SomeNode | null,
            predicate: NamedNode | null,
            object: SomeTerm | null,
            justOne: boolean = false,
        ): Quadruple[] {
            return super.match(
                subject ? this.primary(subject) : null,
                predicate ? this.primary(predicate) as NamedNode : null,
                object
                    ? (isNode(object) ? this.primary(object) : object)
                    : null,
                justOne,
            );
        }

        /** @private */
        public primary(node: SomeNode): SomeNode {
            const p = this.defaultGraph.primary(node.value);

            if (p.startsWith("_:")) {
                return this.rdfFactory.blankNode(p);
            } else {
                return this.rdfFactory.namedNode(p);
            }
        }
    };
}
