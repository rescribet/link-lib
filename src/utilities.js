
export function normalizePropery(obj) {
  if (typeof obj === 'undefined' || obj === false) {
    return undefined;
  } else if (obj.constructor === Array) {
    return obj.map(dom => dom['@id']);
  } else if (typeof obj === 'object') {
    return obj['@id'];
  }
  throw new Error(typeof obj);
}

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
