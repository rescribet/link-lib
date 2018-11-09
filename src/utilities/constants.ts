import { NamedNode, Namespace } from "rdflib";

import { NamespaceMap } from "../types";

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

export const defaultNS: Readonly<NamespaceMap> = Object.freeze({
    argu: Namespace("https://argu.co/ns/core#"),
    as: Namespace("https://www.w3.org/ns/activitystreams#"),
    bibo: Namespace("http://purl.org/ontology/bibo/"),
    cc: Namespace("http://creativecommons.org/ns#"),
    dbo: Namespace("http://dbpedia.org/ontology/"),
    dbp: Namespace("http://dbpedia.org/property/"),
    dbpedia: Namespace("http://dbpedia.org/resource/"),
    dc: Namespace("http://purl.org/dc/terms/"),
    ex: Namespace("http://example.com/ns#"),
    example: Namespace("http://www.example.com/"),
    fhir: Namespace("http://hl7.org/fhir/"),
    fhir3: Namespace("http://hl7.org/fhir/STU3"),
    foaf: Namespace("http://xmlns.com/foaf/0.1/"),
    geo: Namespace("http://www.w3.org/2003/01/geo/wgs84_pos#"),
    http: Namespace("http://www.w3.org/2011/http#"),
    http07: Namespace("http://www.w3.org/2007/ont/http#"),
    httph: Namespace("http://www.w3.org/2007/ont/httph#"),
    hydra: Namespace("http://www.w3.org/ns/hydra/core#"),
    ianalr: Namespace("http://www.iana.org/assignments/link-relations/"),
    link: Namespace("http://www.w3.org/2007/ont/link#"),
    ll: Namespace("http://purl.org/link-lib/"),
    owl: Namespace("http://www.w3.org/2002/07/owl#"),
    p: Namespace("http://www.wikidata.org/prop/"),
    prov: Namespace("http://www.w3.org/ns/prov#"),
    rdf: Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
    rdfs: Namespace("http://www.w3.org/2000/01/rdf-schema#"),
    schema: Namespace("http://schema.org/"),
    sh: Namespace("http://www.w3.org/ns/shacl#"),
    skos: Namespace("http://www.w3.org/2004/02/skos/core#"),
    wd: Namespace("http://www.wikidata.org/entity/"),
    wdata: Namespace("https://www.wikidata.org/wiki/Special:EntityData/"),
    wdref: Namespace("http://www.wikidata.org/reference/"),
    wds: Namespace("http://www.wikidata.org/entity/statement/"),
    wdt: Namespace("http://www.wikidata.org/prop/direct/"),
    wdv: Namespace("http://www.wikidata.org/value/"),
    xmlns: Namespace("http://www.w3.org/2000/xmlns/"),
    xsd: Namespace("http://www.w3.org/2001/XMLSchema#"),
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
