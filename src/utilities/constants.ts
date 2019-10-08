import as from "@ontologies/as";
import { createNS, NamedNode } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import schema from "@ontologies/schema";
import shacl from "@ontologies/shacl";

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

export const ll = {
    ns: createNS("http://purl.org/link-lib/"),
};

/** @deprecated Use the @ontologies/<ns> packages directly, these provide better typing and documentation */
export const defaultNS = Object.freeze({
    argu: createNS("https://argu.co/ns/core#"),
    as: as.ns,
    bibo: createNS("http://purl.org/ontology/bibo/"),
    cc: createNS("http://creativecommons.org/ns#"),
    dbo: createNS("http://dbpedia.org/ontology/"),
    dbp: createNS("http://dbpedia.org/property/"),
    dbpedia: createNS("http://dbpedia.org/resource/"),
    dcat: createNS("http://www.w3.org/ns/dcat#"),
    dctype: createNS("http://purl.org/dc/dcmitype/"),
    ex: createNS("http://example.com/ns#"),
    example: createNS("http://www.example.com/"),
    fhir: createNS("http://hl7.org/fhir/"),
    fhir3: createNS("http://hl7.org/fhir/STU3"),
    foaf: createNS("http://xmlns.com/foaf/0.1/"),
    geo: createNS("http://www.w3.org/2003/01/geo/wgs84_pos#"),
    http: createNS("http://www.w3.org/2011/http#"),
    http07: createNS("http://www.w3.org/2007/ont/http#"),
    httph: createNS("http://www.w3.org/2007/ont/httph#"),
    hydra: createNS("http://www.w3.org/ns/hydra/core#"),
    ianalr: createNS("http://www.iana.org/assignments/link-relations/"),
    ld: createNS("http://purl.org/linked-delta/"),
    link: createNS("http://www.w3.org/2007/ont/link#"),
    ll: createNS("http://purl.org/link-lib/"),
    owl: createNS("http://www.w3.org/2002/07/owl#"),
    p: createNS("http://www.wikidata.org/prop/"),
    prov: createNS("http://www.w3.org/ns/prov#"),
    qb: createNS("http://purl.org/linked-data/cube#"),
    rdf: rdf.ns,
    rdfs: rdfs.ns,
    schema: schema.ns,
    sh: shacl.ns,
    shacl: shacl.ns,
    skos: createNS("http://www.w3.org/2004/02/skos/core#"),
    wd: createNS("http://www.wikidata.org/entity/"),
    wdata: createNS("https://www.wikidata.org/wiki/Special:EntityData/"),
    wdref: createNS("http://www.wikidata.org/reference/"),
    wds: createNS("http://www.wikidata.org/entity/statement/"),
    wdt: createNS("http://www.wikidata.org/prop/direct/"),
    wdv: createNS("http://www.wikidata.org/value/"),
    xmlns: createNS("http://www.w3.org/2000/xmlns/"),
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
