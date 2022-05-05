/* Taken, stripped and modified from rdflib.js */

import {
    isNode,
    NamedNode,
    Node,
    Quadruple,
    SomeTerm,
    TermType,
} from "@ontologies/core";
import { sameAs } from "@ontologies/owl";

import { SomeNode } from "../types";

import { RDFAdapter } from "./RDFAdapter";
import { Id, StructuredStore } from "./StructuredStore";

export type Constructable<T = object> = new (...args: any[]) => T;

// tslint:disable-next-line:typedef
export function Equatable<BC extends Constructable<RDFAdapter>>(base: BC) {
    return class extends base {
        public classOrder: Record<TermType, number> = {
            BlankNode: 6,
            Literal: 1,
            NamedNode: 5,
        };
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
                    this.equate(record._id, sameAsValue as Node);
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

        public equate(a: Node, b: Node): void {
            const primary1 = this.primary(a);
            const primary2 = this.primary(b);
            const rank = this.compareTerm(primary1, primary2);

            if (rank > 0) {
                this.updatePrimary(a, b);
            } else if (rank < 0) {
                this.updatePrimary(b, a);
            }
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
        public compareTerm(u1: Node, u2: Node): number {
            if (this.classOrder[u1.termType] < this.classOrder[u2.termType]) {
                return -1;
            }
            if (this.classOrder[u1.termType] > this.classOrder[u2.termType]) {
                return 1;
            }
            if (u1.value < u2.value) {
                return -1;
            }
            if (u1.value > u2.value) {
                return 1;
            }
            return 0;
        }

        /** @private */
        public primary(node: SomeNode): SomeNode {
            const p = this.defaultGraph.primary(node.value);

            if (node.termType === TermType.NamedNode) {
                return this.rdfFactory.namedNode(p);
            } else {
                return this.rdfFactory.blankNode(p);
            }
        }

        /** @private */
        public updatePrimary(previous: Node, current: Node): void {
            this.defaultGraph = this.defaultGraph.withAlias(previous.value, current.value);
        }
    };
}
