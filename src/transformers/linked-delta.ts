import { Quad, Quadruple } from "@ontologies/core";
import { NQuadsParser } from "n-quads-parser";

import { LinkedRenderStore } from "../LinkedRenderStore";
import {
    ExtensionResponse,
    RDFLibFetcherRequest,
    ResponseAndFallbacks,
    ResponseTransformer,
} from "../types";

/**
 * Processes linked-delta responses.
 */

export function linkedDeltaProcessor(lrs: LinkedRenderStore<any>): ResponseTransformer {
    return async function processLinkedDelta(response: ResponseAndFallbacks): Promise<Quad[]> {
        let data: string;
        if (response instanceof Response) {
            data = response.bodyUsed ? "" : await response.text();
        } else if (typeof XMLHttpRequest !== "undefined" && response instanceof XMLHttpRequest) {
            data = response.responseText;
        } else {
            data = (response as RDFLibFetcherRequest | ExtensionResponse).body;
        }

        if (!data || data.length === 0) {
            return [];
        }

        const parser = new NQuadsParser((lrs as any).store.getInternalStore());
        const quads = parser.parseString(data) as Array<Quadruple | void>;
        const expedite = response.hasOwnProperty("expedite") ? (response as any).expedite : false;

        lrs.queueDelta(quads, expedite);

        // TODO: Resolve the statements in this request
        return [];
    };
}
