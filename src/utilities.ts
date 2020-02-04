/* global chrome */
import {
    HexPos,
    Hextuple,
    isBlankNode,
    isHextuple, isLiteral,
    JSResource,
    Literal,
} from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";

import { Term } from "./rdf";
import { SomeNode } from "./types";
import { literalFromHex } from "./utilities/hex";

const memberPrefix = rdf.ns("_");

/**
 * Filters {obj} to only include statements where the subject equals {predicate}.
 * @param obj The statements to filter.
 * @param predicate The subject to filter for.
 * @return A possibly empty filtered array of statements.
 */
export function allRDFPropertyStatements(
    obj: Hextuple[] | undefined,
    predicate: JSResource,
): Hextuple[] {

    if (typeof obj === "undefined") {
        return [];
    }

    if (predicate === rdfs.member) {
        return obj.filter((h) => h[1] === rdfs.member || h[1].startsWith(memberPrefix));
    }

    return obj.filter((h) => h[1] === predicate);
}

/**
 * Filters {obj} on subject {predicate} returning the resulting statements' objects.
 * @see allRDFPropertyStatements
 */
export function allRDFValues(obj: Hextuple[], predicate: JSResource): Literal[] {
    const props = allRDFPropertyStatements(obj, predicate);
    if (props.length === 0) {
        return [];
    }

    return props.map((h) => [h[2], h[3], h[4]]);
}

/**
 * Resolve {predicate} to any value, if any. If present, additional values are ignored.
 */
export function anyRDFValue(obj: Hextuple[] | undefined, predicate: JSResource): Literal | undefined {
    if (!Array.isArray(obj)) {
        return undefined;
    }

    const match = predicate === rdfs.member
        ? obj.find((h) => h[1].startsWith(memberPrefix))
        :  obj.find((h) => h[1] === predicate);

    if (typeof match === "undefined") {
        return undefined;
    }

    return literalFromHex(match);
}

export function getPropBestLang<T extends Literal = Literal>(rawProp: Hextuple | Hextuple[], langPrefs: string[]): T {
    if (isHextuple(rawProp)) {
        return literalFromHex(rawProp) as unknown as T;
    }
    if (rawProp.length === 1) {
        return literalFromHex(rawProp[0]) as unknown as T;
    }
    for (let i = 0; i < langPrefs.length; i++) {
        const pIndex = rawProp.findIndex((p) => p[HexPos.objectLang] === langPrefs[i]);
        if (pIndex >= 0) {
            return literalFromHex(rawProp[pIndex]) as unknown as T;
        }
    }

    return literalFromHex(rawProp[0]) as unknown as T;
}

export function getPropBestLangRaw(statements: Hextuple | Hextuple[], langPrefs: string[]): Hextuple {
    if (isHextuple(statements)) {
        return statements;
    }
    if (statements.length === 1) {
        return statements[0];
    }
    for (let i = 0; i < langPrefs.length; i++) {
        const pIndex = statements.findIndex((s) =>
            s[HexPos.objectLang] === langPrefs[i]);
        if (pIndex >= 0) {
            return statements[pIndex];
        }
    }

    return statements[0];
}

export function getTermBestLang(rawTerm: Literal | Literal[], langPrefs: string[]): Literal {
    if (isLiteral(rawTerm)) {
        return rawTerm;
    }
    if (rawTerm.length === 1) {
        return rawTerm[0];
    }
    for (let i = 0; i < langPrefs.length; i++) {
        const pIndex = rawTerm.findIndex((p) => Array.isArray(p) && p[2] === langPrefs[i]);
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
    if (isBlankNode(href)) {
        return false;
    }

    return !(href as string).startsWith(self.location.origin + "/");
}

export function normalizeType<T1>(type: T1 | T1[]): T1[] {
    return Array.isArray(type) ? type : [type];
}

export function equals(a: Term, b: Term): boolean {
    if (typeof a !== typeof b || typeof a === "string") {
        return a === b;
    }

    return a[0] === b[0]
        && a[1] === b[1]
        && a[2] === b[2];
}
