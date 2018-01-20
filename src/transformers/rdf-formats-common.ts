import {
    graph,
    parse,
    Statement,
} from "rdflib";
import { ResponseAndFallbacks } from "../types";

import { getContentType, getURL } from "../utilities/responses";

/**
 * Processes a range of media types with parsers from the
 * [rdflib.js package](https://www.npmjs.com/package/rdflib).
 */
export async function processRDF(response: ResponseAndFallbacks): Promise<Statement[]> {
    let data: string;
    if (response instanceof Response) {
        data = response.bodyUsed ? "" : await response.text();
    } else if (response instanceof XMLHttpRequest) {
        data = response.responseText;
    } else {
        data = response.body;
    }

    const format = getContentType(response);
    const g = graph();

    await new Promise((resolve): void => {
        parse(data, g, getURL(response), format, () => {
            resolve();
        });
    });

    return g.statements;
}
