import {
    IndexedFormula,
    Serializer,
} from "rdflib";
import { Quad } from "../rdf";
import { ChangeBuffer } from "../types";

/**
 * Fix rdflib issue where multiline strings are serialized in nquads.
 * @see https://github.com/linkeddata/rdflib.js/pull/282
 * @monkey
 */
export function patchRDFLibSerializer<T>(serializer: Serializer<T>, fallback: string): void {
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
 * Patch rdflib with memoized versions of terms by overriding certain object methods.
 * For browsers that don't support Proxy.
 */
export function patchRDFLibStoreWithOverrides<T>(graph: IndexedFormula<T>,
                                                 changeBufferTarget: ChangeBuffer): IndexedFormula<T> {
    // Don't try this at home, kids!
    graph.statements.push = (...elems: any): number => {
        let elem;
        for (let i = 0, len = elems.length; i < len; i++) {
            elem = elems[i];
            changeBufferTarget.changeBuffer[changeBufferTarget.changeBufferCount] = elem;
            changeBufferTarget.changeBufferCount++;
        }
        return Array.prototype.push.call(graph.statements, ...elems);
    };

    graph.statements.splice = (index: any, len: any): Array<Quad<T>> => {
        const rem = Array.prototype.splice.call(graph.statements, index, len);
        changeBufferTarget.changeBuffer.push(...rem);
        changeBufferTarget.changeBufferCount += len;
        return rem;
    };

    return graph;
}
