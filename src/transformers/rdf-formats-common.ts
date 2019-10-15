import { Quad } from "@ontologies/core";
import { graph, RDFparse } from "../rdflib";
import { RDFLibFetcherResponse, ResponseAndFallbacks } from "../types";

import { getContentType, getURL } from "../utilities/responses";

const isRdfLibResponse = (res: any): res is RDFLibFetcherResponse =>
    typeof res.req !== "undefined" && typeof res.req.termType !== "undefined";

/**
 * Processes a range of media types with parsers from the
 * [rdflib.js package](https://www.npmjs.com/package/rdflib).
 */
export async function processRDF(response: ResponseAndFallbacks): Promise<Quad[]> {
    let data: string;
    if (isRdfLibResponse(response)) {
        data = response.responseText;
    } else if (response instanceof Response) {
        data = response.bodyUsed ? "" : await response.text();
    } else if (response instanceof XMLHttpRequest) {
        data = response.responseText;
    } else {
        data = response.body;
    }

    const format = getContentType(response);
    const g = graph();

    await new Promise((resolve): void => {
        RDFparse(data, g, getURL(response), format, () => {
            resolve();
        });
    });

    return g.statements;
}
