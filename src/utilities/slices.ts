import { SomeTerm } from "@ontologies/core";

import { Id, MultimapTerm } from "../store/types";
import { normalizeType } from "../utilities";

export const mergeTerms = (
  a: SomeTerm | MultimapTerm | undefined,
  b: SomeTerm | MultimapTerm,
): SomeTerm | MultimapTerm => {
  if (Array.isArray(a)) {
    return Array.from(new Set([...a, ...normalizeType(b)]));
  } else if (a) {
    return Array.from(new Set([a, ...normalizeType(b)]));
  } else {
    return b;
  }
};

export const isLocalId = (id: Id): boolean => id.startsWith("_:");

export const isGlobalId = (id: Id): boolean => id.startsWith("/") || (id.includes(":") && !id.startsWith("_:"));
