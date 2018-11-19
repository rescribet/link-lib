import { NamedNode, Statement } from "rdflib";
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
import { memoizedNamespace } from "../utilities/memoizedNamespace";
import { nsRDFSResource } from "./rdfs";

const nsRDFSsubClassOf = NS.rdfs("subClassOf");
const ianaMT = memoizedNamespace("http://www.w3.org/ns/iana/media-types/");
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
        new Statement(NS.link("Document"), nsRDFSsubClassOf, nsRDFSResource),
        new Statement(ianaJSONResource, nsRDFSsubClassOf, nsRDFSResource),
        new Statement(ianaJSONLDResource, nsRDFSsubClassOf, nsRDFSResource),
        new Statement(ianaN3Resource, nsRDFSsubClassOf, nsRDFSResource),
        new Statement(ianaNTResource, nsRDFSsubClassOf, nsRDFSResource),
        new Statement(ianaNQResource, nsRDFSsubClassOf, nsRDFSResource),
        new Statement(ianaPlainResource, nsRDFSsubClassOf, nsRDFSResource),
        new Statement(ianaRDFXMLResource, nsRDFSsubClassOf, nsRDFSResource),
        new Statement(ianaTTLResource, nsRDFSsubClassOf, nsRDFSResource),
    ],

    processStatement(_: Statement, __: VocabularyProcessingContext): Statement[] | null {
        return null;
    },

    processType(_: NamedNode, __: VocabularyProcessingContext): boolean {
        return false;
    },
};
