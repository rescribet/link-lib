/* global chrome */
import rdf from 'rdflib';

export const F_NTRIPLES = 'application/n-triples';
export const F_TURTLE = 'text/turtle';
export const F_N3 = 'text/n3';
export const F_PLAIN = 'text/plain';
export const F_JSON = 'application/json';
export const F_JSONLD = 'application/ld+json';
export const F_JSONAPI = 'application/vnd.api+json';
export const F_RDF_XML = 'application/rdf+xml';

export const F_NTRIPLES_DEP = 'text/ntriples';
export const F_TURTLE_DEP = 'application/x-turtle';

export const NON_CONTENT_EXTS = ['php', 'asp', 'aspx', 'cgi', 'jsp'];

export const defaultNS = Object.freeze({
  argu: rdf.Namespace('https://argu.co/ns/core#'),
  bibo: rdf.Namespace('http://purl.org/ontology/bibo/'),
  cc: rdf.Namespace('http://creativecommons.org/ns#'),
  dbo: rdf.Namespace('http://dbpedia.org/ontology/'),
  dc: rdf.Namespace('http://purl.org/dc/terms/'),
  dbpedia: rdf.Namespace('http://dbpedia.org/resource/'),
  foaf: rdf.Namespace('http://xmlns.com/foaf/0.1/'),
  geo: rdf.Namespace('http://www.w3.org/2003/01/geo/wgs84_pos#'),
  http: rdf.Namespace('http://www.w3.org/2011/http#'),
  hydra: rdf.Namespace('http://www.w3.org/ns/hydra/core#'),
  ll: rdf.Namespace('http://purl.org/link-lib/'),
  owl: rdf.Namespace('http://www.w3.org/2002/07/owl#'),
  p: rdf.Namespace('http://www.wikidata.org/prop/'),
  prov: rdf.Namespace('http://www.w3.org/ns/prov#'),
  rdf: rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
  rdfs: rdf.Namespace('http://www.w3.org/2000/01/rdf-schema#'),
  schema: rdf.Namespace('http://schema.org/'),
  skos: rdf.Namespace('http://www.w3.org/2004/02/skos/core#'),
  wdata: rdf.Namespace('https://www.wikidata.org/wiki/Special:EntityData/'),
  wd: rdf.Namespace('http://www.wikidata.org/entity/'),
  wds: rdf.Namespace('http://www.wikidata.org/entity/statement/'),
  wdref: rdf.Namespace('http://www.wikidata.org/reference/'),
  wdv: rdf.Namespace('http://www.wikidata.org/value/'),
  wdt: rdf.Namespace('http://www.wikidata.org/prop/direct/'),
  xmlns: rdf.Namespace('http://www.w3.org/2000/xmlns/'),
  xsd: rdf.Namespace('http://www.w3.org/2001/XMLSchema#'),
});


export function allRDFPropertyTriples(obj, prop) {
  if (typeof obj === 'undefined') return undefined;

  const props = obj.filter(s => s.predicate.equals(prop));
  return (props.length === 0) ? undefined : props;
}

export function allRDFValues(obj, prop, term = false) {
  const props = allRDFPropertyTriples(obj, prop);
  if (typeof props === 'undefined') return undefined;

  const terms = props.map(s => s.object);
  if (term) return terms;
  return terms.map(s => s.value);
}

export function allObjectValues(obj, prop, term = false) {
  if (typeof obj === 'undefined' || typeof obj[prop] === 'undefined') return undefined;

  if (term) return obj[prop];

  return Array.isArray(obj[prop])
    ? obj[prop].map(val => val.value)
    : obj[prop].value;
}

export function anyRDFValue(obj, prop, term = true) {
  if (typeof obj === 'undefined') return undefined;

  const match = obj.find(s => s.predicate.equals(prop));
  if (typeof match === 'undefined') return undefined;
  return term
    ? match.object
    : match.object.value;
}

export function anyObjectValue(obj, prop, term = false) {
  if (typeof obj === 'undefined' || typeof obj[prop] === 'undefined') return undefined;

  if (typeof obj[prop] === 'undefined') return undefined;

  return term ? obj[prop] : obj[prop].value;
}


/** @access private */
export function fetchWithExtension(iri, formats) {
  const c = getExtention();
  if (c !== undefined) {
    return new Promise((resolve) => {
      c.onMessage.addListener((message, port) => {
        port.disconnect();
        c.disconnect();
        resolve(message);
      });
      c.postMessage({
        accept: formats,
        fetch: iri,
      });
    });
  }
  throw new Error('NoExtensionInstalledError');
}

/**
 * Returns a flattened version of the property's contents.
 * @param obj A(n array of) property object(s)
 * @returns {*} The property with possible @id attributes flattened
 */
export function flattenProperty(obj) {
  if (obj === undefined || obj === false) {
    return undefined;
  } else if (obj.constructor === Array) {
    return obj.map(dom => dom['@id']);
  } else if (typeof obj === 'object') {
    return obj['@id'];
  }
  throw new Error(typeof obj);
}

/**
 * Extracts the content type from a request.
 * The content-type value has precedence if it contains a known type.
 * Otherwise it returns the extension if present, or the content-type without the encoding.
 *
 * @summary Extracts the content type from a request.
 * @access private
 * @param res
 * @returns {*}
 */
export function getContentType(res) {
  const contentTypeRaw = getHeader(res, 'Content-Type');
  const contentType = contentTypeRaw.split(';')[0];
  const urlMatch = new URL(res.url || res.requestedURI).href.match(/\.([a-zA-Z0-9]{1,8})($|\?|#)/);
  const ext = urlMatch && urlMatch[1];
  if (contentType) {
    if (contentType.includes(F_NTRIPLES) || contentType.includes(F_NTRIPLES_DEP)) {
      return F_NTRIPLES;
    } else if (contentType.includes(F_PLAIN) && ['ntriples', 'nt'].indexOf(ext) >= 0) {
      return F_NTRIPLES;
    } else if (contentType.includes(F_TURTLE) || contentType.includes(F_TURTLE_DEP)) {
      return F_TURTLE;
    } else if (contentType.includes(F_N3)) {
      return F_N3;
    } else if (contentType.includes(F_JSONLD)) {
      return F_JSONLD;
    } else if (contentType.includes(F_JSONAPI)) {
      return F_JSONAPI;
    } else if (contentType.includes(F_RDF_XML)) {
      return F_RDF_XML;
    } else if (contentType.includes(F_JSON) && typeof res.body === 'string') {
      if (res.body.match(/^{\W*"(data|errors|meta|jsonapi|links|included)":\W*\{\W*/) !== null) {
        return F_JSONAPI;
      }
    }
  }
  if (ext && !NON_CONTENT_EXTS.includes(ext)) {
    if (['ttl'].includes(ext)) {
      return F_TURTLE;
    } else if (['ntriples', 'nt'].includes(ext)) {
      return F_NTRIPLES;
    } else if (['jsonld'].includes(ext)) {
      return F_JSONLD;
    } else if (['n3'].includes(ext)) {
      return F_N3;
    }
    return ext;
  }
  return contentTypeRaw.split(';')[0];
}

/**
 * Tries to resolve the data extension.
 * @returns {Object|undefined}
 */
export function getExtention() {
  if (typeof chrome !== 'undefined' && typeof chrome.runtime.connect !== 'undefined') {
    return chrome.runtime.connect('kjgnkcpcclnlchifkbbnekmgmcefhagd');
  }
  return undefined;
}

export function getHeader(res, header) {
  if (typeof res.headers.get === 'function') {
    return res.headers.get(header);
  } else if (typeof res.getResponseHeader === 'function') {
    return res.getResponseHeader(header);
  }
  return res.headers[header];
}

/**
 * Get a property for an object of which the method to get is unsure.
 * Currently handles regular and immutable.js objects.
 * @param obj The object to get the property from.
 * @param prop The property to get.
 * @returns {*} Whatever the property's value is, if any.
 */
export function getP(obj, prop) {
  if (obj === undefined || prop === undefined) {
    return undefined;
  }
  if (obj && typeof obj.get === 'function') {
    return obj.get(prop);
  }
  return obj[prop];
}

/**
 * Returns the inner value for a property in JSON-LD structured objects.
 * @param {Object} prop The property to retrieve the value from.
 * @returns {*} The value of the property if any.
 */
export function getValueOrIDJSONLD(prop) {
  if (hasP(prop, '@value')) {
    return getP(prop, '@value');
  }
  if (hasP(prop, '@id')) {
    return getP(prop, '@id');
  }
  return prop;
}

/**
 * Returns the inner value for a property in triple structured objects.
 * @param {Object} prop The property to retrieve the value from.
 * @returns {*} The value of the property if any.
 */
export function getValueOrID(prop) {
  if (prop.constructor.name === 'Statement') {
    return prop.object.value;
  }
  if (typeof prop === 'object') {
    if (prop.value) {
      return prop.value;
    }
    return getValueOrIDJSONLD(prop);
  }
  return typeof prop.first === 'function' ? prop.first() : prop;
}

/**
 * Determine whether an object has a certain property.
 * @param obj The object to check the property on.
 * @param prop The property name.
 * @returns {Boolean} Whether the object has the property (even if it's value is falsy).
 */
export function hasP(obj, prop) {
  if (obj && typeof obj.has === 'function') {
    return obj.has(prop);
  }
  return obj && Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Checks if the origin of {href} matches current origin from {window.location}
 * @access public
 * @returns {boolean} `true` if matches, `false` otherwise.
 */
export function isDifferentOrigin(href) {
  return self.location.origin !== new URL(href).origin;
}

/** @access private */
export function isLinkedData(mediaType) {
  return [F_NTRIPLES, F_TURTLE, F_N3, F_JSONLD].includes(mediaType);
}

/**
 * Checks if {obj} is present in the property by comparing whether the {include} value is
 * present in any of the {obj} `@id` values or as a literal.
 * @access public
 * @summary Checks if {obj} is present in the property
 * @param obj The property object
 * @param include The value to look for in {obj}
 * @returns {Object|undefined} The found value or undefined.
 */
export function propertyIncludes(obj, include) {
  if (obj === undefined) {
    return undefined;
  }
  const includes = Array.isArray(include) ? include : [include];
  if (obj.constructor === Array) {
    return obj.find(dom => propertyIncludes(dom['@id'], includes));
  } else if (typeof obj === 'object') {
    return includes.find(o => o === obj['@id']);
  } else if (typeof obj === 'string') {
    return includes.find(o => o === obj);
  }
  throw new Error(typeof obj);
}
