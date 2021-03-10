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

import { equals, id } from "../factoryHelpers";
import { SomeNode } from "../types";

import BasicStore from "./BasicStore";
import { IndexedStore } from "./Indexable";

export type Constructable<T = object> = new (...args: any[]) => T;

// tslint:disable-next-line:typedef
export function Equatable<BC extends Constructable<IndexedStore & BasicStore>>(base: BC) {
    return class extends base {
        public aliases: Node[][] = [];
        public redirections: Node[] = [];
        public classOrder: Record<TermType, number> = {
            BlankNode: 6,
            Literal: 1,
            NamedNode: 5,
        };

        public constructor(...args: any[]) {
            super(...args);

            this.addDataCallback((quad: Quad) => {
                if (equals(quad.predicate, sameAs)) {
                    this.equate(quad.subject, quad.object as Node);
                }
            });
        }

        public canon<T = Term>(term: T): T {
            if (!isNode(term)) {
                return term;
            }

            return this.redirections[id(term)] as unknown as T || term;
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

        /**
         * simplify graph in store when we realize two identifiers are equivalent
         * We replace the bigger with the smaller.
         */
        public equate(u1: Node, u2: Node): void {
            // log.warn("Equating "+u1+" and "+u2); // @@
            // @@JAMBO Must canonicalize the uris to prevent errors from a=b=c
            // 03-21-2010
            u1 = this.canon(u1);
            u2 = this.canon(u2);
            const d = this.compareTerm(u1, u2);
            if (!d) {
                return undefined; // No information in {a = a}
            }

            if (d < 0) { // u1 less than u2
                return this.replaceWith(u2, u1);
            } else {
                return this.replaceWith(u1, u2);
            }
        }

        public match(
            subject: SomeNode | null,
            predicate: NamedNode | null,
            object: SomeTerm | null,
            graph: SomeNode | null,
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

        /**
         * Replace big with small, obsoleted with obsoleting.
         */
        public replaceWith(big: Node, small: Node): void {
            // log.debug("Replacing "+big+" with "+small) // this.id(@@
            const oldhash = id(big);
            const newhash = id(small);
            const moveIndex = (ix: Quad[][]): void => {
                const oldlist = ix[oldhash];
                if (!oldlist) {
                    return; // none to move
                }
                const newlist = ix[newhash];
                if (!newlist) {
                    ix[newhash] = oldlist;
                } else {
                    ix[newhash] = oldlist.concat(newlist);
                }
                delete ix[oldhash];
            };
            // the canonical one carries all the indexes
            for (let i = 0; i < 4; i++) {
                moveIndex(this.indices[i]);
            }
            this.redirections[oldhash] = small;
            if (big.value) {
                // @@JAMBO: must update redirections,aliases from sub-items, too.
                if (!this.aliases[newhash]) {
                    this.aliases[newhash] = [];
                }
                this.aliases[newhash].push(big); // Back link
                if (this.aliases[oldhash]) {
                    for (let i = 0; i < this.aliases[oldhash].length; i++) {
                        this.redirections[id(this.aliases[oldhash][i])] = small;
                        this.aliases[newhash].push(this.aliases[oldhash][i]);
                    }
                }
                this.add(small, this.rdfFactory.namedNode("http://www.w3.org/2007/ont/link#uri"), big);
            }
        }
    };
}
