import { createNS } from "@ontologies/core";

const ld = createNS("http://purl.org/linked-delta/");

export default {
  ns: ld,

  /**
   * Adds the statement to the store, without duplication.
   */
  // eslint-disable-next-line sort-keys
  add: ld("add"),
  /**
   * Removes the entire subject from the store.
   */
  purge: ld("purge"),
  /***
   * Removes all (subject,predicate,) matches from the store.
   *
   * @see slice
   */
  remove: ld("remove"),
  /***
   * Replaces the (subject, predicate,) with the one(s) in this delta.
   */
  replace: ld("replace"),
  /**
   * Removes all (subject,predicate,object) matches from the store.
   *
   * @see remove
   */
  slice: ld("slice"),
  /**
   * Removes all statements of (subject,,) from the store and replaces them with those in the delta.
   */
  supplant: ld("supplant"),
};
