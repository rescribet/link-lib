/* Taken, stripped and modified from rdflib.js */

import {
    HexPos,
    Hextuple,
    isResource,
    Resource,
} from "@ontologies/core";
import owl from "@ontologies/owl";

import { NamedNode, SomeTerm } from "../rdf";
import { SomeNode } from "../types";
import { termTypeOrder } from "../utilities/hex";
import BasicStore from "./BasicStore";
import { IndexedStore } from "./Indexable";

export type Constructable<T = object> = new (...args: any[]) => T;

// tslint:disable-next-line:typedef
export function Equatable<BC extends Constructable<IndexedStore & BasicStore>>(base: BC) {
    return class extends base {
        public aliases: Map<string, Resource[]> = new Map<string, Resource[]>();
        public redirections: Map<string, Resource> = new Map<string, Resource>();
        public hasRedirections: boolean = false;

        public constructor(...args: any[]) {
            super(...args);

            this.addDataCallback((quad: Hextuple) => {
                if (quad[HexPos.predicate] === owl.sameAs) {
                    this.equate(quad[HexPos.subject], quad[HexPos.object]);
                }
            });
        }

        public canon<T extends Resource = Resource>(term: T): T {
            if (!this.hasRedirections || term === undefined || term === null) {
                return term;
            }

            return this.redirections.get(term) as T || term;
        }

        public compareTerm(u1: Resource, u2: Resource): number {
            if (termTypeOrder(u1) < termTypeOrder(u2)) {
                return -1;
            }
            if (termTypeOrder(u1) > termTypeOrder(u2)) {
                return 1;
            }
            if (u1 < u2) {
                return -1;
            }
            if (u1 > u2) {
                return 1;
            }
            return 0;
        }

        public id(x: Resource): string {
            return x as string;
        }

        /**
         * simplify graph in store when we realize two identifiers are equivalent
         * We replace the bigger with the smaller.
         */
        public equate(u1: Resource, u2: Resource): void {
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
        ): Hextuple[] {
            return super.match(
                subject ? this.canon(subject) : null,
                predicate ? this.canon(predicate) : null,
                object
                    ? (isResource(object) ? this.canon(object) : object)
                    : null,
                graph ? this.canon(graph) : null,
                justOne,
            );
        }

        /**
         * Replace big with small, obsoleted with obsoleting.
         */
        public replaceWith(big: Resource, small: Resource): void {
            // log.debug("Replacing "+big+" with "+small) // this.id(@@
            const oldhash = big;
            const newhash = small;
            const moveIndex = (ix: {[k: string]: Hextuple[]}): void => {
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
            const len = this.indices.length;
            for (let i = 0; i < len; i++) {
                moveIndex(this.indices[i]);
            }
            this.redirections.set(oldhash, small);
            this.hasRedirections = true;
            if (big) {
                // @@JAMBO: must update redirections,aliases from sub-items, too.
                if (!this.aliases.get(newhash)) {
                    this.aliases.set(newhash, []);
                }
                this.aliases.get(newhash)!.push(big); // Back link
                const oldAlias = this.aliases.get(oldhash);
                if (oldAlias) {
                    for (let i = 0; i < oldAlias.length; i++) {
                        this.redirections.set(oldAlias[i], small);
                        this.aliases.set(
                            newhash,
                            [...this.aliases.get(newhash)!, oldAlias[i]],
                        );
                    }
                }
                this.add(small, this.rdfFactory.namedNode("http://www.w3.org/2007/ont/link#uri"), big);
            }
        }
    };
}
