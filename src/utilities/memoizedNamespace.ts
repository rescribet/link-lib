import {
    NamedNamespace,
    NamedNode,
    TermIsh,
} from "rdflib";

import { NamespaceMap } from "../types";

import { defaultNS } from "./constants";

const CI_MATCH_PREFIX = 0;
const CI_MATCH_SUFFIX = 1;

/**
 * Expands a property if it's in short-form while preserving long-form.
 * Note: The vocabulary needs to be present in the store prefix library
 * @param prop The short- or long-form property
 * @param namespaces Object of namespaces by their abbreviation.
 * @returns The (expanded) property
 */
export function expandProperty(prop: NamedNode | TermIsh | string | undefined,
                               namespaces: NamespaceMap = defaultNS): NamedNode | undefined {
    if (prop instanceof NamedNode || typeof prop === "undefined") {
        return prop;
    }
    if (typeof prop === "object") {
        if (prop.termType === "NamedNode") {
            return NamedNode.find(prop.value);
        }

        return undefined;
    }

    if (prop.indexOf("/") >= 1) {
        return NamedNode.find(prop);
    }
    const matches = prop.split(":");
    const constructor: NamedNamespace | undefined = namespaces[matches[CI_MATCH_PREFIX]];

    return constructor && constructor(matches[CI_MATCH_SUFFIX]);
}
