import as from "@ontologies/as";
import { createNS } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import schema from "@ontologies/schema";
import shacl from "@ontologies/shacl";
import { Namespace } from "rdflib";

import { NamedNode, RDFObjectBase } from "../rdf";

export const F_NTRIPLES = "application/n-triples";
export const F_NQUADS = "application/n-quads";
export const F_TURTLE = "text/turtle";
export const F_N3 = "text/n3";
export const F_PLAIN = "text/plain";
export const F_JSON = "application/json";
export const F_JSONLD = "application/ld+json";
export const F_RDF_XML = "application/rdf+xml";

export const F_NTRIPLES_DEP = "text/ntriples";
export const F_TURTLE_DEP = "application/x-turtle";

export const NON_CONTENT_EXTS = ["php", "asp", "aspx", "cgi", "jsp"];

// From http://dublincore.org/specifications/dublin-core/dcmi-terms/2012-06-14/
const dc = Namespace("http://purl.org/dc/terms/", [
    // Properties
    "abstract", "accessRights", "accrualMethod", "accrualPeriodicity", "accrualPolicy", "alternative", "audience",
    "available", "bibliographicCitation", "conformsTo", "contributor", "coverage", "created", "creator", "date",
    "dateAccepted", "dateCopyrighted", "dateSubmitted", "description", "educationLevel", "extent", "format",
    "hasFormat", "hasPart", "hasVersion", "identifier", "instructionalMethod", "isFormatOf", "isPartOf",
    "isReferencedBy", "isReplacedBy", "isRequiredBy", "issued", "isVersionOf", "language", "license", "mediator",
    "medium", "modified", "provenance", "publisher", "references", "relation", "replaces", "requires", "rights",
    "rightsHolder", "source", "spatial", "subject", "tableOfContents", "temporal", "title", "type", "valid",
    // Vocabulary Encoding Schemes
    "DCMIType", "DDC", "IMT", "LCC", "LCSH", "MESH", "NLM", "TGN", "UDC",
    // Classes
    "Agent", "AgentClass", "BibliographicResource", "FileFormat", "Frequency", "Jurisdiction", "LicenseDocument",
    "LinguisticSystem", "Location", "LocationPeriodOrJurisdiction", "MediaType", "MediaTypeOrExtent",
    "MethodOfAccrual", "MethodOfInstruction", "PeriodOfTime", "PhysicalMedium", "PhysicalResource", "Policy",
    "ProvenanceStatement", "RightsStatement", "SizeOrDuration", "Standard",
]);

// From https://www.w3.org/TR/2012/REC-xmlschema11-2-20120405/#sec-datatypes-and-facets with subtractions from
// https://www.w3.org/2011/rdf-wg/wiki/XSD_Datatypes which don't match any mapping
const xsd = Namespace("http://www.w3.org/2001/XMLSchema#", [
    "string", "boolean", "float", "double", "decimal", "dateTime", "time", "date", "gYearMonth", "gYear",
    "gMonthDay", "gDay", "gMonth", "hexBinary", "base64Binary", "anyURI", "normalizedString", "token", "language",
    "NMTOKEN", "Name", "NCName", "integer", "nonPositiveInteger", "negativeInteger", "long", "int", "short", "byte",
    "nonNegativeInteger", "unsignedLong", "unsignedInt", "unsignedShort", "unsignedByte", "positiveInteger",
    "yearMonthDuration", "dayTimeDuration", "dateTimeStamp",
]);

export const defaultNS = Object.freeze({
    argu: createNS<RDFObjectBase>("https://argu.co/ns/core#"),
    as,
    bibo: createNS<RDFObjectBase>("http://purl.org/ontology/bibo/"),
    cc: createNS<RDFObjectBase>("http://creativecommons.org/ns#"),
    dbo: createNS<RDFObjectBase>("http://dbpedia.org/ontology/"),
    dbp: createNS<RDFObjectBase>("http://dbpedia.org/property/"),
    dbpedia: createNS<RDFObjectBase>("http://dbpedia.org/resource/"),
    dc,
    dcat: createNS<RDFObjectBase>("http://www.w3.org/ns/dcat#"),
    dctype: createNS<RDFObjectBase>("http://purl.org/dc/dcmitype/"),
    ex: createNS<RDFObjectBase>("http://example.com/ns#"),
    example: createNS<RDFObjectBase>("http://www.example.com/"),
    fhir: createNS<RDFObjectBase>("http://hl7.org/fhir/"),
    fhir3: createNS<RDFObjectBase>("http://hl7.org/fhir/STU3"),
    foaf: createNS<RDFObjectBase>("http://xmlns.com/foaf/0.1/"),
    geo: createNS<RDFObjectBase>("http://www.w3.org/2003/01/geo/wgs84_pos#"),
    http: createNS<RDFObjectBase>("http://www.w3.org/2011/http#"),
    http07: createNS<RDFObjectBase>("http://www.w3.org/2007/ont/http#"),
    httph: createNS<RDFObjectBase>("http://www.w3.org/2007/ont/httph#"),
    hydra: createNS<RDFObjectBase>("http://www.w3.org/ns/hydra/core#"),
    ianalr: createNS<RDFObjectBase>("http://www.iana.org/assignments/link-relations/"),
    link: createNS<RDFObjectBase>("http://www.w3.org/2007/ont/link#"),
    ll: createNS<RDFObjectBase>("http://purl.org/link-lib/"),
    owl: createNS<RDFObjectBase>("http://www.w3.org/2002/07/owl#"),
    p: createNS<RDFObjectBase>("http://www.wikidata.org/prop/"),
    prov: createNS<RDFObjectBase>("http://www.w3.org/ns/prov#"),
    qb: createNS<RDFObjectBase>("http://purl.org/linked-data/cube#"),
    rdf,
    rdfs,
    schema,
    sh: shacl,
    shacl,
    skos: createNS<RDFObjectBase>("http://www.w3.org/2004/02/skos/core#"),
    wd: createNS<RDFObjectBase>("http://www.wikidata.org/entity/"),
    wdata: createNS<RDFObjectBase>("https://www.wikidata.org/wiki/Special:EntityData/"),
    wdref: createNS<RDFObjectBase>("http://www.wikidata.org/reference/"),
    wds: createNS<RDFObjectBase>("http://www.wikidata.org/entity/statement/"),
    wdt: createNS<RDFObjectBase>("http://www.wikidata.org/prop/direct/"),
    wdv: createNS<RDFObjectBase>("http://www.wikidata.org/value/"),
    xmlns: createNS<RDFObjectBase>("http://www.w3.org/2000/xmlns/"),
    xsd,
});

export const DEFAULT_TOPOLOGY: NamedNode = defaultNS.ll("defaultTopology");

/** Constant used to determine that a class is used to render a type rather than a property. */
export const RENDER_CLASS_NAME: NamedNode = defaultNS.ll("typeRenderClass");

export const MAIN_NODE_DEFAULT_IRI = defaultNS.ll("targetResource");
// tslint:disable-next-line ban-types
export const NON_DATA_OBJECTS_CTORS: Function[] = [
    Array,
    ArrayBuffer,
    Boolean,
    DataView,
    Date,
    Error,
    EvalError,
    Float32Array,
    Float64Array,
    Int16Array,
    Int32Array,
    Int8Array,
    Intl.Collator,
    Intl.DateTimeFormat,
    Intl.NumberFormat,
    Map,
    Number,
    Promise,
    (typeof Proxy !== "undefined" ? Proxy : undefined)!,
    RangeError,
    ReferenceError,
    RegExp,
    Set,
].filter(Boolean);
export const MSG_BAD_REQUEST = "Request failed with bad status code";
export const MSG_INCORRECT_TARGET = "Collections or Literals can't be the target";
export const MSG_URL_UNDEFINED = "No url given with action.";
export const MSG_URL_UNRESOLVABLE = "Can't execute action with non-named-node url.";
export const MSG_OBJECT_NOT_IRI = "Action object property must be an IRI.";
