// @ts-ignore: Unused import // https://github.com/Microsoft/TypeScript/issues/5711
import { Statement } from "rdflib";

// @ts-ignore: Unused import
import { ExtensionResponse, RDFLibFetcherRequest } from "../types";

import { processRDF } from "./rdf-formats-common";

export const transformers = {
    processRDF,
};
