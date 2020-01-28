import { Hextuple } from "@ontologies/core";
import { ChangeBuffer } from "../types";

/**
 * Patch rdflib with memoized versions of terms by overriding certain object methods.
 * For browsers that don't support Proxy.
 */
export function patchRDFLibStoreWithOverrides<T extends any = any>(
    graph: T,
    changeBufferTarget: ChangeBuffer,
): T {
    if (typeof graph.indices !== "undefined") {
        graph.addDataCallback((quad: Hextuple): void => {
            changeBufferTarget.changeBuffer[changeBufferTarget.changeBufferCount] = quad;
            changeBufferTarget.changeBufferCount++;
        });
    } else {
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
    }

    if (typeof graph.indices !== "undefined") {
        graph.removeCallback = (quad: Hextuple): void => {
            changeBufferTarget.changeBuffer.push(quad);
            changeBufferTarget.changeBufferCount++;
        };
    } else {
        graph.statements.splice = (index: any, len: any): Hextuple[] => {
            const rem = Array.prototype.splice.call(graph.statements, index, len);
            changeBufferTarget.changeBuffer.push(...rem);
            changeBufferTarget.changeBufferCount += len;
            return rem;
        };
    }

    return graph;
}
