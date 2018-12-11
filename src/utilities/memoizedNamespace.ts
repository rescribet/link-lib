import { BlankNode, Literal, NamedNamespace, NamedNode, Namespace, SomeTerm, TermIsh } from "rdflib";

import { NamespaceMap } from "../types";

import { defaultNS } from "./constants";

let termIndex = 0;
const termMap: Array<BlankNode | NamedNode> = [];
const nsMap: { [k: string]: NamedNode } = {};
const bnMap: { [k: string]: BlankNode } = {};

export function namedNodeByStoreIndex(un: number): NamedNode | undefined {
    const term = termMap[un];
    if (!term) {
        return undefined;
    }
    if (term.termType === "NamedNode") {
        return term;
    }

    return undefined;
}

export function nodeByStoreIndex(un: number): BlankNode | NamedNode | undefined {
    return termMap[un];
}

export function blankNodeById(id: string): BlankNode {
    const fromMap = bnMap[id];
    if (fromMap !== undefined) {
        return fromMap;
    }

    return addBn(new BlankNode(id));
}

export function namedNodeByIRI(iri: string): NamedNode {
    const fromMap = nsMap[iri];
    if (fromMap !== undefined) {
        return fromMap;
    }
    const ln = iri.split(/[\/#]/).pop()!.split("?").shift() || "";

    return add(new NamedNode(iri), ln);
}

function add(nn: NamedNode, ln: string): NamedNode {
    nn.sI = ++termIndex;
    nn.term = ln;
    termMap[nn.sI] = nsMap[nn.value] = nn;

    return nn;
}

function addBn(bn: BlankNode): BlankNode {
    bn.sI = ++termIndex;
    termMap[bn.sI] = bnMap[bn.value] = bn;

    return bn;
}

export function memoizedNamespace(nsIRI: string): (ns: string) => NamedNode {
    const ns = Namespace(nsIRI);

    return (ln: string): NamedNode => {
        const fullIRI = nsIRI + ln;
        if (nsMap[fullIRI] !== undefined) {
            return nsMap[fullIRI];
        }

        return add(ns(ln), ln);
    };
}

const CI_MATCH_PREFIX = 0;
const CI_MATCH_SUFFIX = 1;

export function normalizeTerm(term: SomeTerm | undefined): SomeTerm | undefined {
    if (term && term.termType === "NamedNode" && term.sI === undefined) {
        return namedNodeByIRI(term.value) || term;
    }
    if (term && term.termType === "BlankNode" && term.sI === undefined) {
        return blankNodeById(term.value) || term;
    }
    if (term && term.termType === "Literal" && term.datatype && term.datatype.sI === undefined) {
        return new Literal(term.value, term.language, namedNodeByIRI(term.datatype.value));
    }
    return term;
}

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
            return namedNodeByIRI(prop.value);
        }

        return undefined;
    }

    if (prop.indexOf("/") >= 1) {
        return namedNodeByIRI(prop);
    }
    const matches = prop.split(":");
    const constructor: NamedNamespace | undefined = namespaces[matches[CI_MATCH_PREFIX]];

    return constructor && constructor(matches[CI_MATCH_SUFFIX]);
}
