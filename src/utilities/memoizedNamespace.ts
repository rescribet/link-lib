import rdfFactory, { Namespace } from "@ontologies/core";
import { NamedNode, Term } from "../rdf";

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
export function expandProperty(prop: NamedNode | Term | string | undefined,
                               namespaces: NamespaceMap = defaultNS): NamedNode | undefined {
    if (!prop) {
        return prop as undefined;
    }
    if (typeof prop !== "string"
        && Object.prototype.hasOwnProperty.call(prop, "termType")
        && (prop as Term).termType === "NamedNode") {

        return rdfFactory.namedNode(prop.value);
    }
    if (typeof prop === "object") {
        if (prop.termType === "NamedNode") {
            return rdfFactory.namedNode(prop.value);
        }

        return undefined;
    }

    if (prop.indexOf("/") >= 1) {
        if (prop.startsWith("<") && prop.endsWith(">")) {
            return rdfFactory.namedNode(prop.slice(1, -1));
        }
        return rdfFactory.namedNode(prop);
    }
    const matches = prop.split(":");
    const constructor: Namespace | undefined = namespaces[matches[CI_MATCH_PREFIX]];

    return constructor && constructor(matches[CI_MATCH_SUFFIX]);
}
