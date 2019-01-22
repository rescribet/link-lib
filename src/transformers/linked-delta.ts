import { NQuadsParser } from "n-quads-parser";
import { Statement } from "rdflib";
import { LinkedRenderStore } from "../LinkedRenderStore";
import { ResponseAndFallbacks, ResponseTransformer } from "../types";

/**
 * Processes linked-delta responses.
 */

export function linkedDeltaProcessor(lrs: LinkedRenderStore<any>): ResponseTransformer {
    return async function processLinkedDelta(response: ResponseAndFallbacks): Promise<Statement[]> {
        let data: string;
        if (response instanceof Response) {
            data = response.bodyUsed ? "" : await response.text();
        } else if (response instanceof XMLHttpRequest) {
            data = response.responseText;
        } else {
            data = response.body;
        }

        if (!data || data.length === 0) {
            return [];
        }

        const parser = new NQuadsParser((lrs as any).store.getInternalStore());
        const quads = parser.parseString(data);

        return lrs.processDelta(quads);
    };
}
