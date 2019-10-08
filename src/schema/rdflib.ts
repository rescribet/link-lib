import rdfFactory, { createNS, NamedNode, Quad } from "@ontologies/core";
import { Resource, subClassOf } from "@ontologies/rdfs";

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
        rdfFactory.quad(NS.link("Document"), subClassOf, Resource),
        rdfFactory.quad(ianaJSONResource, subClassOf, Resource),
        rdfFactory.quad(ianaJSONLDResource, subClassOf, Resource),
        rdfFactory.quad(ianaN3Resource, subClassOf, Resource),
        rdfFactory.quad(ianaNTResource, subClassOf, Resource),
        rdfFactory.quad(ianaNQResource, subClassOf, Resource),
        rdfFactory.quad(ianaPlainResource, subClassOf, Resource),
        rdfFactory.quad(ianaRDFXMLResource, subClassOf, Resource),
        rdfFactory.quad(ianaTTLResource, subClassOf, Resource),
    ],

    processStatement(_: Quad, __: VocabularyProcessingContext): Quad[] | null {
        return null;
    },

    processType(_: NamedNode, __: VocabularyProcessingContext): boolean {
        return false;
    },
};
