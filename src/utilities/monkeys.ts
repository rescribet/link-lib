import { Quad } from "@ontologies/core";
import { ChangeBuffer } from "../types";

export function addChangeBufferCallbacks<T extends any = any>(
    graph: any,
    changeBufferTarget: ChangeBuffer,
): T {
    if (typeof graph.indices !== "undefined") {
        graph.addDataCallback((quad: Quad): void => {
            changeBufferTarget.changeBuffer[changeBufferTarget.changeBufferCount] = quad;
            changeBufferTarget.changeBufferCount++;
        });

        graph.removeCallback = (quad: Quad): void => {
            changeBufferTarget.changeBuffer.push(quad);
            changeBufferTarget.changeBufferCount++;
        };
    }

    return graph;
}
