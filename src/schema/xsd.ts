import rdfFactory, { NamedNode, Quad } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import xsd from "@ontologies/xsd";

import { VocabularyProcessingContext, VocabularyProcessor } from "../types";

/**
 * Implements the RDF/RDFS axioms and rules.
 * @type {VocabularyProcessor}
 */
export const XSD = {
    axioms: [
        // https://www.w3.org/TR/2012/REC-owl2-rdf-based-semantics-20121211/#item-int-parts-datatypes
        // https://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/#built-in-primitive-datatypes
        rdfFactory.quad(xsd.string, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.boolean, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.decimal, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.float, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.double, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.duration, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.dateTime, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.time, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.date, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.gYearMonth, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.gYear, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.gMonthDay, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.gDay, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.gMonth, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.hexBinary, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.base64Binary, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.anyURI, rdf.type, rdfs.Datatype),

        // https://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/#ordinary-built-ins
        rdfFactory.quad(xsd.normalizedString, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.token, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.language, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.NMTOKEN, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.Name, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.NCName, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.integer, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.nonPositiveInteger, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.negativeInteger, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.long, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.int, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.short, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.byte, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.nonNegativeInteger, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.unsignedLong, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.unsignedInt, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.unsignedShort, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.unsignedByte, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.positiveInteger, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.yearMonthDuration, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.dayTimeDuration, rdf.type, rdfs.Datatype),
        rdfFactory.quad(xsd.dateTimeStamp, rdf.type, rdfs.Datatype),
    ],

    processStatement(_: Quad, __: VocabularyProcessingContext): Quad[] | null {
        return null;
    },

    processType(_: NamedNode, __: VocabularyProcessingContext): boolean {
        return false;
    },
} as VocabularyProcessor;
