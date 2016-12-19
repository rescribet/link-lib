import rdf from 'rdf-ext';

/**
 * Finds and returns the first occurrence that matches the given terms.
 * A {null} value acts as a wildcard.
 * @param subject {null|object|rdf.NamedValue} The value to match on the subject.
 * @param predicate {null|object|rdf.NamedValue} The value to match on the predicate.
 * @param object {null|object|rdf.NamedValue} The value to match on the object.
 * @returns {rdf.Quad|rdf.Triple|undefined} The matched object or {undefined} when not found.
 */
rdf.Graph.prototype.find = function (subject, predicate, object) {
  const arr = this.toArray();
  for (let i = 0; i < arr.length; i++) {
    const s = subject === null || arr[i].subject === subject || arr[i].subject.equals(subject);
    const p = predicate === null || arr[i].predicate === predicate || arr[i].predicate.equals(predicate);
    const o = object === null || arr[i].object === object || arr[i].object.equals(object);
    if (s && p && o) {
      return arr[i];
    }
  }
  return undefined;
};
