/* global chrome */
import rdfFactory, { TermType } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import { BlankNode, Literal, NamedNode, Quad, Term } from "./rdf";

import { SomeNode } from "./types";

const memberPrefix = rdf.ns("_").value;

/**
 * Filters {obj} to only include statements where the subject equals {predicate}.
 * @param obj The statements to filter.
 * @param predicate The subject to filter for.
 * @return A possibly empty filtered array of statements.
 */
export function allRDFPropertyStatements(
    obj: Quad[] | undefined,
    predicate: SomeNode): Quad[] {

    if (typeof obj === "undefined") {
        return [];
    }

    if (rdfFactory.equals(predicate, rdfs.member)) {
        return obj.filter((s) =>
            rdfFactory.equals(s.predicate, rdfs.member)
            || s.predicate.value.startsWith(memberPrefix));
    }

    return obj.filter((s) => rdfFactory.equals(s.predicate, predicate));
}

/**
 * Filters {obj} on subject {predicate} returning the resulting statements' objects.
 * @see allRDFPropertyStatements
 */
export function allRDFValues(obj: Quad[], predicate: SomeNode): Term[] {
    const props = allRDFPropertyStatements(obj, predicate);
    if (props.length === 0) {
        return [];
    }

    return props.map((s) => s.object);
}

/**
 * Resolve {predicate} to any value, if any. If present, additional values are ignored.
 */
export function anyRDFValue(obj: Quad[] | undefined, predicate: SomeNode): Term | undefined {
    if (!Array.isArray(obj)) {
        return undefined;
    }

    const match = rdfFactory.equals(predicate, rdfs.member)
        ? obj.find((s) => s.predicate.value.startsWith(memberPrefix))
        :  obj.find((s) => rdfFactory.equals(s.predicate, predicate));

    if (typeof match === "undefined") {
        return undefined;
    }

    return match.object;
}

export function doc<T extends NamedNode | BlankNode>(iri: T): T {
    if (iri.value.includes("#")) {
        return rdfFactory.namedNode(iri.value.split("#").shift()!);
    }

    return iri;
}

export function getPropBestLang<T extends Term = Term>(rawProp: Quad | Quad[], langPrefs: string[]): T {
    if (!Array.isArray(rawProp)) {
        return rawProp.object as T;
    }
    if (rawProp.length === 1) {
        return rawProp[0].object as T;
    }
    for (let i = 0; i < langPrefs.length; i++) {
        const pIndex = rawProp.findIndex((p) => "language" in p.object
            && (p.object as Literal).language === langPrefs[i]);
        if (pIndex >= 0) {
            return rawProp[pIndex].object as T;
        }
    }

    return rawProp[0].object as T;
}

export function getPropBestLangRaw(statements: Quad | Quad[], langPrefs: string[]): Quad {
    if (!Array.isArray(statements)) {
        return statements;
    }
    if (statements.length === 1) {
        return statements[0];
    }
    for (let i = 0; i < langPrefs.length; i++) {
        const pIndex = statements.findIndex((s) => "language" in s.object
            && (s.object as Literal).language === langPrefs[i]);
        if (pIndex >= 0) {
            return statements[pIndex];
        }
    }

    return statements[0];
}

export function getTermBestLang(rawTerm: Term | Term[], langPrefs: string[]): Term {
    if (!Array.isArray(rawTerm)) {
        return rawTerm;
    }
    if (rawTerm.length === 1) {
        return rawTerm[0];
    }
    for (let i = 0; i < langPrefs.length; i++) {
        const pIndex = rawTerm.findIndex((p) => "language" in p && (p as Literal).language === langPrefs[i]);
        if (pIndex >= 0) {
            return rawTerm[pIndex];
        }
    }

    return rawTerm[0];
}

/**
 * Checks if the origin of {href} matches current origin from {window.location}
 * @returns `true` if matches, `false` otherwise.
 */
export function isDifferentOrigin(href: SomeNode | string): boolean {
    if (typeof href !== "string" && href.termType === TermType.BlankNode) {
        return false;
    }
    const origin = typeof href !== "string" ? href.value : href;

    return !origin.startsWith(self.location.origin + "/");
}

export function normalizeType<T1>(type: T1 | T1[]): T1[] {
    return Array.isArray(type) ? type : [type];
}
