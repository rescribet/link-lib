import { Quadruple } from "@ontologies/core";
import { ChangeBuffer } from "../types";

export function addChangeBufferCallbacks<T extends any = any>(
    graph: any,
    changeBufferTarget: ChangeBuffer,
): T {
    graph.addDataCallback((quad: Quadruple): void => {
        changeBufferTarget.changeBuffer[changeBufferTarget.changeBufferCount] = quad;
        changeBufferTarget.changeBufferCount++;
    });

    graph.removeCallback = (quad: Quadruple): void => {
        changeBufferTarget.changeBuffer.push(quad);
        changeBufferTarget.changeBufferCount++;
    };

    return graph;
}
