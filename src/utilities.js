/**
 * Returns a flattened version of the property's contents.
 * @param obj A(n array of) property object(s)
 * @returns {*} The property with possible @id attributes flattened
 */
export function flattenProperty(obj) {
  if (typeof obj === 'undefined' || obj === false) {
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
 * @summary Checks if {obj} is present in the property
 * @param obj The property object
 * @param include The value to look for in {obj}
 * @returns {Object, undefined} The found value or undefined.
 */
export function propertyIncludes(obj, include) {
  if (typeof obj === 'undefined') {
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
