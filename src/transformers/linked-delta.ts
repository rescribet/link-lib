import { NQuadsParser, Quadruple } from "n-quads-parser";
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
        const quads: Array<Quadruple | Statement> = parser.parseString(data);
        for (let i = 0, len = quads.length; i < len; i++) {
            quads[i] = Statement.from(...quads[i] as Quadruple);
        }

        lrs.processDelta(quads as Statement[]);

        return quads as Statement[];
    };
}
