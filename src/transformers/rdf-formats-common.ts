import { Quadruple } from "@ontologies/core";
import { RDFAdapter } from "../store/RDFAdapter";
import { RDFLibFetcherResponse, ResponseAndFallbacks } from "../types";

import { getContentType, getURL } from "../utilities/responses";

const isRdfLibResponse = (res: any): res is RDFLibFetcherResponse =>
    typeof res.req !== "undefined" && typeof res.req.termType !== "undefined";

export type RDFLibParse = (str: string,
                           kb: RDFAdapter,
                           base: string,
                           contentType: string,
                           callback: () => void) => void;

/**
 * Processes a range of media types with parsers from the
 * [rdflib.js package](https://www.npmjs.com/package/rdflib).
 */
export const createProcessRDF = (rdfParse: RDFLibParse): (response: ResponseAndFallbacks) => Promise<Quadruple[]> => {
    return async function processRDF(response: ResponseAndFallbacks): Promise<Quadruple[]> {
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
        const g = new RDFAdapter();

        await new Promise<void>((resolve): void => {
            rdfParse(data, g, getURL(response), format, () => {
                resolve();
            });
        });

        return g.quads;
    };
};
