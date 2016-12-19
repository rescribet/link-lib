/* global chrome */

export const F_GRAPH = 'F_GRAPH';
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

/**
 * Returns the inner value for a property in JSON-LD structured objects.
 * @param {Object} prop The property to retrieve the value from.
 * @returns {*} The value of the property if any.
 */
export function getValueOrID(prop) {
  return prop && (prop['@value'] || prop['@id'] || prop);
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
  const contentTypeRaw = typeof res.headers.get === 'undefined' ?
    res.headers['Content-Type'] : res.headers.get('Content-Type');
  const contentType = contentTypeRaw.split(';')[0];
  const urlMatch = new URL(res.url).href.match('\.([a-zA-Z]*)[$|\?|#]');
  const ext = urlMatch && urlMatch[1];
  if (contentType !== undefined) {
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
  if (!NON_CONTENT_EXTS.includes(ext)) {
    return ext;
  }
  return contentTypeRaw.split(';')[0];
}

/**
 * Checks if the origin of {href} matches current origin from {window.location}
 * @access public
 * @returns {boolean} `true` if matches, `false` otherwise.
 */
export function isDifferentOrigin(href) {
  return new URL(window.location).origin !== new URL(href).origin;
}

/** @access private */
export function isLinkedData(mediaType) {
  return [F_NTRIPLES, F_TURTLE, F_N3, F_JSONLD].includes(mediaType);
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
 * Tries to resolve the data extension.
 * @returns {Object|undefined}
 */
export function getExtention() {
  if (chrome && typeof chrome.runtime.connect !== 'undefined') {
    return chrome.runtime.connect('kjgnkcpcclnlchifkbbnekmgmcefhagd');
  }
  return undefined;
}
