/* Parts taken, stripped and modified from rdflib.js */

import {
  DataFactory,
  Quad,
} from "@ontologies/core";

export interface IndexedFormulaOpts {
    quads: Quad[];
    dataCallback: (quad: Quad) => void;
    rdfFactory: DataFactory;
}

/** Query and modify an array of quads. */
export { RDFAdapter as default } from "./RDFAdapter";
