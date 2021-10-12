import { hextupleProcessor } from "./hextuples";
import { linkedDeltaProcessor } from "./linked-delta";
import { createProcessRDF } from "./rdf-formats-common";

export const transformers = {
    createProcessRDF,
    hextupleProcessor,
    linkedDeltaProcessor,
};
