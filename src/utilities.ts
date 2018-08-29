/* global chrome */
import {
    BlankNode,
    NamedNode,
    SomeTerm,
    Statement,
} from "rdflib";

import { SomeNode } from "./types";

/**
 * Filters {obj} to only include statements where the subject equals {predicate}.
 * @param obj The statements to filter.
 * @param predicate The subject to filter for.
 * @return A possibly empty filtered array of statements.
 */
export function allRDFPropertyStatements(obj: Statement[] | undefined, predicate: SomeNode): Statement[] {
    if (typeof obj === "undefined") {
        return [];
    }

    return obj.filter((s) => s.predicate.equals(predicate));
}

/**
 * Filters {obj} on subject {predicate} returning the resulting statements' objects.
 * @see allRDFPropertyStatements
 */
export function allRDFValues(obj: Statement[], predicate: SomeNode): SomeTerm[] {
    const props = allRDFPropertyStatements(obj, predicate);
    if (props.length === 0) {
        return [];
    }

    return props.map((s) => s.object);
}

/**
 * Resolve {predicate} to any value, if any. If present, additional values are ignored.
 */
export function anyRDFValue(obj: Statement[] | undefined, predicate: SomeNode): SomeTerm | undefined {
    if (!Array.isArray(obj)) {
        return undefined;
    }

    const match = obj.find((s) => s.predicate.equals(predicate));
    if (typeof match === "undefined") {
        return undefined;
    }

    return match.object;
}

export function getPropBestLang(rawProp: Statement | Statement[], langPrefs: string[]): SomeTerm {
    if (!Array.isArray(rawProp)) {
        return rawProp.object;
    }
    if (rawProp.length === 1) {
        return rawProp[0].object;
    }
    for (const lang of langPrefs) {
        const pIndex = rawProp.findIndex((p) => "language" in p.object && p.object.language === lang);
        if (pIndex >= 0) {
            return rawProp[pIndex].object;
        }
    }

    return rawProp[0].object;
}

export function getPropBestLangRaw(statements: Statement | Statement[], langPrefs: string[]): Statement {
    if (!Array.isArray(statements)) {
        return statements;
    }
    if (statements.length === 1) {
        return statements[0];
    }
    for (const lang of langPrefs) {
        const pIndex = statements.findIndex((s) => "language" in s.object && s.object.language === lang);
        if (pIndex >= 0) {
            return statements[pIndex];
        }
    }

    return statements[0];
}

export function getTermBestLang(rawTerm: SomeTerm | SomeTerm[], langPrefs: string[]): SomeTerm {
    if (!Array.isArray(rawTerm)) {
        return rawTerm;
    }
    if (rawTerm.length === 1) {
        return rawTerm[0];
    }
    for (const lang of langPrefs) {
        const pIndex = rawTerm.findIndex((p) => "language" in p && p.language === lang);
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
    if (href instanceof BlankNode) {
        return false;
    }
    const origin = href instanceof NamedNode ? href.value : href;

    return !origin.startsWith(self.location.origin + "/");
}

export function normalizeType<T1>(type: T1 | T1[]): T1[] {
    return Array.isArray(type) ? type : [type];
}
