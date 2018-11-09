import {
    IndexedFormula,
    Serializer,
    Statement,
} from "rdflib";
import { ChangeBuffer } from "../types";

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

    return graph;
}

/**
 * Patch rdflib with memoized versions of terms by overriding certain object methods.
 * For browsers that don't support Proxy.
 */
export function patchRDFLibStoreWithOverrides(graph: IndexedFormula, changeBufferTarget: ChangeBuffer): IndexedFormula {
    // Don't try this at home, kids!
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
