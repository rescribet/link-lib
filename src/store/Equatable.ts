/* Taken, stripped and modified from rdflib.js */

import {
  isNode,
  NamedNode,
  Node,
  Quad,
  SomeTerm,
  Term,
  TermType,
} from "@ontologies/core";
import { sameAs } from "@ontologies/owl";

import { equals } from "../factoryHelpers";
import { SomeNode } from "../types";

import BasicStore from "./BasicStore";
import { StructuredStore } from "./StructuredStore";

export type Constructable<T = object> = new (...args: any[]) => T;

// tslint:disable-next-line:typedef
export function Equatable<BC extends Constructable<BasicStore>>(base: BC) {
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

            this.addDataCallback((quad: Quad) => {
                if (equals(quad.predicate, sameAs)) {
                    this.equate(quad.subject, quad.object as Node);
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

        /** @deprecated */
        public canon<T = Term>(term: T): T {
            if (!isNode(term)) {
                return term;
            }

            const primary = this.defaultGraph.primary(term.value);

            if (primary.includes("/") || primary === this.defaultGraphValue) {
                return this.rdfFactory.namedNode(primary) as unknown as T;
            } else {
                return this.rdfFactory.blankNode(primary) as unknown as T;
            }
        }

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
            graph: SomeNode | null = this.rdfFactory.defaultGraph(),
            justOne: boolean = false,
        ): Quad[] {
            return super.match(
                subject ? this.canon(subject) : null,
                predicate ? this.canon(predicate) as NamedNode : null,
                object
                    ? (isNode(object) ? this.canon(object) : object)
                    : null,
                graph ? this.canon(graph) : null,
                justOne,
            );
        }

        /** @private */
        public primary(node: Node): Node {
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
