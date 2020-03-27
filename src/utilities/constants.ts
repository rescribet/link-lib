import { NamedNode } from "@ontologies/core";

import ll from "../ontology/ll";

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

export const DEFAULT_TOPOLOGY: NamedNode = ll.defaultTopology;

/** Constant used to determine that a class is used to render a type rather than a property. */
export const RENDER_CLASS_NAME: NamedNode = ll.typeRenderClass;

export const MAIN_NODE_DEFAULT_IRI = ll.targetResource;
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
    /* istanbul ignore next */
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
