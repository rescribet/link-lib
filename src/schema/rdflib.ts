import { Resource, subClassOf } from "@ontologies/rdfs";

import rdf, { createNS, NamedNode, Quad } from "../rdf";
import { VocabularyProcessingContext } from "../types";

import {
    defaultNS as NS,
    F_JSON,
    F_JSONLD,
    F_N3,
    F_NQUADS,
    F_NTRIPLES,
    F_PLAIN,
    F_RDF_XML,
    F_TURTLE,
} from "../utilities/constants";

const ianaMT = createNS("http://www.w3.org/ns/iana/media-types/");
const ianaJSONResource = ianaMT(`${F_JSON}#Resource`);
const ianaJSONLDResource = ianaMT(`${F_JSONLD}#Resource`);
const ianaN3Resource = ianaMT(`${F_N3}#Resource`);
const ianaNTResource = ianaMT(`${F_NTRIPLES}#Resource`);
const ianaNQResource = ianaMT(`${F_NQUADS}#Resource`);
const ianaPlainResource = ianaMT(`${F_PLAIN}#Resource`);
const ianaRDFXMLResource = ianaMT(`${F_RDF_XML}#Resource`);
const ianaTTLResource = ianaMT(`${F_TURTLE}#Resource`);

/**
 * Implements the assumptions done by rdflib.js in various parts of their code.
 */
export const RDFLIB = {
    axioms: [
        rdf.quad(NS.link("Document"), subClassOf, Resource),
        rdf.quad(ianaJSONResource, subClassOf, Resource),
        rdf.quad(ianaJSONLDResource, subClassOf, Resource),
        rdf.quad(ianaN3Resource, subClassOf, Resource),
        rdf.quad(ianaNTResource, subClassOf, Resource),
        rdf.quad(ianaNQResource, subClassOf, Resource),
        rdf.quad(ianaPlainResource, subClassOf, Resource),
        rdf.quad(ianaRDFXMLResource, subClassOf, Resource),
        rdf.quad(ianaTTLResource, subClassOf, Resource),
    ],

    processStatement(_: Quad, __: VocabularyProcessingContext): Quad[] | null {
        return null;
    },

    processType(_: NamedNode, __: VocabularyProcessingContext): boolean {
        return false;
    },
};
