/* global chrome */
import rdfFactory from "@ontologies/core";
import { Literal, Quad, Term } from "./rdf";

import { SomeNode } from "./types";
import { defaultNS } from "./utilities/constants";

const memberPrefix = defaultNS.rdf.ns("_").value;

/**
 * Filters {obj} to only include statements where the subject equals {predicate}.
 * @param obj The statements to filter.
 * @param predicate The subject to filter for.
 * @return A possibly empty filtered array of statements.
 */
export function allRDFPropertyStatements<RDFBase>(
    obj: Array<Quad<RDFBase>> | undefined,
    predicate: SomeNode<RDFBase>): Array<Quad<RDFBase>> {

    if (typeof obj === "undefined") {
        return [];
    }

    if (rdfFactory.equals(predicate, defaultNS.rdfs.ns("member"))) {
        return obj.filter((s) =>
            rdfFactory.equals(s.predicate, defaultNS.rdfs.ns("member"))
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

    const match = predicate === defaultNS.rdfs.ns("member")
        ? obj.find((s) => s.predicate.value.startsWith(memberPrefix))
        :  obj.find((s) => rdfFactory.equals(s.predicate, predicate));

    if (typeof match === "undefined") {
        return undefined;
    }

    return match.object;
}

export function getPropBestLang(rawProp: Quad | Quad[], langPrefs: string[]): Term {
    if (!Array.isArray(rawProp)) {
        return rawProp.object;
    }
    if (rawProp.length === 1) {
        return rawProp[0].object;
    }
    for (let i = 0; i < langPrefs.length; i++) {
        const pIndex = rawProp.findIndex((p) => "language" in p.object
            && (p.object as Literal).language === langPrefs[i]);
        if (pIndex >= 0) {
            return rawProp[pIndex].object;
        }
    }

    return rawProp[0].object;
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
    if (typeof href !== "string" && href.termType === "BlankNode") {
        return false;
    }
    const origin = typeof href !== "string" ? href.value : href;

    return !origin.startsWith(self.location.origin + "/");
}

export function normalizeType<T1>(type: T1 | T1[]): T1[] {
    return Array.isArray(type) ? type : [type];
}
