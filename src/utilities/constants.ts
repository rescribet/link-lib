import { NamedNode } from "rdflib";

import { NamespaceMap } from "../types";

import { memoizedNamespace } from "./memoizedNamespace";

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
    argu: memoizedNamespace("https://argu.co/ns/core#"),
    as: memoizedNamespace("https://www.w3.org/ns/activitystreams#"),
    bibo: memoizedNamespace("http://purl.org/ontology/bibo/"),
    cc: memoizedNamespace("http://creativecommons.org/ns#"),
    dbo: memoizedNamespace("http://dbpedia.org/ontology/"),
    dbp: memoizedNamespace("http://dbpedia.org/property/"),
    dbpedia: memoizedNamespace("http://dbpedia.org/resource/"),
    dc: memoizedNamespace("http://purl.org/dc/terms/"),
    ex: memoizedNamespace("http://example.com/ns#"),
    example: memoizedNamespace("http://www.example.com/"),
    fhir: memoizedNamespace("http://hl7.org/fhir/"),
    fhir3: memoizedNamespace("http://hl7.org/fhir/STU3"),
    foaf: memoizedNamespace("http://xmlns.com/foaf/0.1/"),
    geo: memoizedNamespace("http://www.w3.org/2003/01/geo/wgs84_pos#"),
    http: memoizedNamespace("http://www.w3.org/2011/http#"),
    http07: memoizedNamespace("http://www.w3.org/2007/ont/http#"),
    httph: memoizedNamespace("http://www.w3.org/2007/ont/httph#"),
    hydra: memoizedNamespace("http://www.w3.org/ns/hydra/core#"),
    ianalr: memoizedNamespace("http://www.iana.org/assignments/link-relations/"),
    link: memoizedNamespace("http://www.w3.org/2007/ont/link#"),
    ll: memoizedNamespace("http://purl.org/link-lib/"),
    owl: memoizedNamespace("http://www.w3.org/2002/07/owl#"),
    p: memoizedNamespace("http://www.wikidata.org/prop/"),
    prov: memoizedNamespace("http://www.w3.org/ns/prov#"),
    rdf: memoizedNamespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
    rdfs: memoizedNamespace("http://www.w3.org/2000/01/rdf-schema#"),
    schema: memoizedNamespace("http://schema.org/"),
    sh: memoizedNamespace("http://www.w3.org/ns/shacl#"),
    skos: memoizedNamespace("http://www.w3.org/2004/02/skos/core#"),
    wd: memoizedNamespace("http://www.wikidata.org/entity/"),
    wdata: memoizedNamespace("https://www.wikidata.org/wiki/Special:EntityData/"),
    wdref: memoizedNamespace("http://www.wikidata.org/reference/"),
    wds: memoizedNamespace("http://www.wikidata.org/entity/statement/"),
    wdt: memoizedNamespace("http://www.wikidata.org/prop/direct/"),
    wdv: memoizedNamespace("http://www.wikidata.org/value/"),
    xmlns: memoizedNamespace("http://www.w3.org/2000/xmlns/"),
    xsd: memoizedNamespace("http://www.w3.org/2001/XMLSchema#"),
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
