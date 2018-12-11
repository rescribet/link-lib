import {
    BlankNode,
    IndexedFormula,
    NamedNode,
    Node,
    Serializer,
    SomeTerm,
    Statement,
} from "rdflib";
import { RDFStore } from "../RDFStore";
import { ChangeBuffer, SomeNode } from "../types";
import { namedNodeByIRI, normalizeTerm } from "./memoizedNamespace";

/**
 * Fix rdflib issue where multiline strings are serialized in nquads.
 * @see https://github.com/linkeddata/rdflib.js/pull/282
 * @monkey
 */
export function patchRDFLibSerializer(serializer: Serializer, fallback: string): void {
    const old = serializer.stringToN3;
    serializer.stringToN3 = function stringToN3(str: string, flags: string): string {
        let flagsWithFallback = flags;
        if (!flags) {
            flagsWithFallback = fallback;
        }

        return old(str, flagsWithFallback);
    };
}

/**
 * Patch rdflib with memoized versions of terms via a Proxy object.
 */
export function patchRDFLibStoreWithProxy(graph: IndexedFormula, changeBufferTarget: ChangeBuffer): IndexedFormula {
    const store = new Proxy(graph, {
        get: (target: any, prop: string): any => {
            if (prop === "add") {
                return (subj: NamedNode | BlankNode, pred: NamedNode, obj: SomeTerm, why: Node):
                    IndexedFormula | null | Statement => {
                    if (Array.isArray(subj)) {
                        if (subj[0] && subj[0].predicate.sI !== undefined) {
                            return target.add(subj);
                        }
                        return target.add(subj.map((s) => new Statement(
                            normalizeTerm(s.subject) as SomeNode,
                            normalizeTerm(s.predicate) as NamedNode,
                            normalizeTerm(s.object) as SomeTerm,
                            s.why,
                        )));
                    }

                    return target.add(
                        normalizeTerm(subj),
                        normalizeTerm(pred),
                        normalizeTerm(obj),
                        why,
                    );
                };
            } else if (prop === "sym") {
                return (uri: string): NamedNode => {
                    return namedNodeByIRI(uri);
                };
            }

            return target[prop as any];
        },
    });

    graph.statements = new Proxy(graph.statements, {
        get: (target: Statement[], prop: string): any => {
            if (prop === "push") {
                return (elem: any): number => {
                    changeBufferTarget.changeBuffer[changeBufferTarget.changeBufferCount] = elem;
                    changeBufferTarget.changeBufferCount++;
                    return target.push(elem);
                };
            } else if (prop === "splice") {
                return (index: any, len: any): Statement[] => {
                    const rem = target.splice(index, len);
                    changeBufferTarget.changeBuffer.push(...rem);
                    changeBufferTarget.changeBufferCount += len;
                    return rem;
                };
            }

            return target[prop as any];
        },
    });

    return store;
}

/**
 * Patch rdflib with memoized versions of terms by overriding certain object methods.
 * For browsers that don't support Proxy.
 */
export function patchRDFLibStoreWithOverrides(graph: IndexedFormula, changeBufferTarget: ChangeBuffer): IndexedFormula {
    // Don't try this at home, kids!

    const storeAdd = graph.add;
    (graph as any).add = function(
        subj: Statement |  NamedNode | BlankNode,
        pred?: NamedNode,
        obj?: SomeTerm, why?: Node,
    ): RDFStore | IndexedFormula | null | Statement {
        if (Array.isArray(subj)) {
            if (subj[0] && subj[0].predicate.sI !== undefined) {
                return storeAdd.call(graph, subj);
            }

            return storeAdd.call(graph, subj.map((s) => new Statement(
                normalizeTerm(s.subject) as SomeNode,
                normalizeTerm(s.predicate) as NamedNode,
                normalizeTerm(s.object) as SomeTerm,
                s.why,
            )));
        }

        let args;
        if (subj instanceof Statement) {
            args = [
                normalizeTerm(subj.subject),
                normalizeTerm(subj.predicate),
                normalizeTerm(subj.object),
                subj.why,
            ];
        } else {
            args = [
                normalizeTerm(subj as SomeNode),
                pred && normalizeTerm(pred),
                obj && normalizeTerm(obj),
                why && why,
            ];
        }

        return (storeAdd as any).apply(graph, args);
    };

    (graph as any).sym = (uri: string): NamedNode => {
        return namedNodeByIRI(uri);
    };

    graph.statements.push = (elem: any): number => {
        changeBufferTarget.changeBuffer[changeBufferTarget.changeBufferCount] = elem;
        changeBufferTarget.changeBufferCount++;
        return Array.prototype.push.call(graph.statements, elem);
    };

    graph.statements.splice = (index: any, len: any): Statement[] => {
        const rem = Array.prototype.splice.call(graph.statements, index, len);
        changeBufferTarget.changeBuffer.push(...rem);
        changeBufferTarget.changeBufferCount += len;
        return rem;
    };

    return graph;
}
