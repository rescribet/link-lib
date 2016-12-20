import rdf from 'rdf-ext';

/**
 * Finds and returns the first occurrence that matches the given terms.
 * A {null} value acts as a wildcard.
 * @param subject {null|object|rdf.NamedValue} The value to match on the subject.
 * @param predicate {null|object|rdf.NamedValue} The value to match on the predicate.
 * @param object {null|object|rdf.NamedValue} The value to match on the object.
 * @returns {rdf.Quad|rdf.Triple|undefined} The matched object or {undefined} when not found.
 */
rdf.Graph.prototype.find = function find(sub, pred, obj) {
  const arr = this.toArray();
  for (let i = 0; i < arr.length; i++) {
    const s = sub === null || arr[i].subject === sub || arr[i].subject.equals(sub);
    const p = pred === null || arr[i].predicate === pred || arr[i].predicate.equals(pred);
    const o = obj === null || arr[i].object === obj || arr[i].object.equals(obj);
    if (s && p && o) {
      return arr[i];
    }
  }
  return undefined;
};
