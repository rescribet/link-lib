import "jest";
import {
    BlankNode,
    Literal,
    NamedNode,
    Statement,
} from "rdflib";

import {
    allRDFPropertyStatements,
    allRDFValues,
    anyRDFValue,
    getPropBestLang,
    getPropBestLangRaw,
    isDifferentOrigin,
    } from "../utilities";
import { defaultNS } from "../utilities/constants";
import { expandProperty, namedNodeByIRI, namedNodeByStoreIndex } from "../utilities/memoizedNamespace";

const ex = defaultNS.example;

describe("utilities", () => {
    describe("#allRDFPropertyStatements", () => {
        it("returns an empty array when undefined is passed", () => {
            expect(allRDFPropertyStatements(undefined, ex("p"))).toHaveLength(0);
        });

        it("returns an empty array when no statements were passed", () => {
            expect(allRDFPropertyStatements([], ex("p"))).toHaveLength(0);
        });

        it("returns an empty array when no matches were found", () => {
            const stmts = [
                new Statement(ex("a"), ex("b"), ex("c")),
                new Statement(ex("d"), ex("p"), ex("e")),
                new Statement(ex("f"), ex("g"), ex("h")),
                new Statement(ex("d"), ex("p"), ex("n")),
                new Statement(ex("f"), ex("g"), ex("x")),
            ];
            expect(allRDFPropertyStatements(stmts, ex("p"))).toEqual([
                new Statement(ex("d"), ex("p"), ex("e")),
                new Statement(ex("d"), ex("p"), ex("n")),
            ]);
        });
    });

    describe("#allRDFValues", () => {
        it("returns an empty array without matches", () => {
            expect(allRDFValues([], ex("p"))).toHaveLength(0);
        });

        it("returns an empty array without matches", () => {
            expect(allRDFValues([
                new Statement(ex("a"), ex("p"), ex("b")),
                new Statement(ex("c"), ex("p"), ex("d")),
            ], ex("p"))).toHaveLength(2);
        });
    });

    describe("#anyRDFValue", () => {
        it("returns undefined no array was passed", () => {
            expect(anyRDFValue(undefined, ex("b"))).toBeUndefined();
        });

        it("returns undefined when predicate not in array", () => {
            expect(anyRDFValue([], ex("b"))).toBeUndefined();
        });

        it("returns the value if found", () => {
            const stmts = [
                new Statement(ex("a"), ex("b"), ex("c")),
                new Statement(ex("c"), ex("b"), ex("d")),
                new Statement(ex("d"), ex("h"), ex("f")),
                new Statement(ex("d"), ex("b"), ex("g")),
            ];
            expect(anyRDFValue(stmts, ex("b"))).toEqual(ex("c"));
        });
    });

    describe("defaultNS", () => {
        it("contains memoized namespaces", () => {
            expect(defaultNS.argu("test")).toHaveProperty("sI");
        });
    });

    describe("#expandProperty", () => {
        it("expands short to long notation", () => {
            const nameShort = expandProperty("schema:name");
            if (nameShort === undefined) {
                throw new TypeError();
            }
            expect(defaultNS.schema("name").sameTerm(nameShort)).toBeTruthy();
        });

        it("preserves long notation", () => {
            const nameLong = expandProperty("http://schema.org/name");
            if (nameLong === undefined) {
                throw new TypeError();
            }
            expect(defaultNS.schema("name").sameTerm(nameLong)).toBeTruthy();
        });
    });

    describe("#getPropBestLang", () => {
        const langs = ["en", "nl", "de", "fr"];
        const deString = new Literal("Wert", "de");
        const enString = new Literal("value", "en");
        const nlString = new Literal("waarde", "nl");

        it("returns when a single statement is given", () => {
            expect(getPropBestLang(new Statement(ex("a"), ex("b"), nlString), langs)).toEqual(nlString);
        });

        it("returns when a single statement arr is given", () => {
            expect(getPropBestLang([new Statement(ex("a"), ex("b"), nlString)], langs)).toEqual(nlString);
        });

        it("returns the correct language when present", () => {
            expect(
                getPropBestLang([
                    new Statement(ex("a"), ex("b"), nlString),
                    new Statement(ex("a"), ex("b"), enString),
                    new Statement(ex("a"), ex("b"), deString),
                ], langs),
            ).toEqual(enString);
        });

        it("returns the next best value when main is not present", () => {
            expect(
                getPropBestLang([
                    new Statement(ex("a"), ex("b"), ex("c")),
                    new Statement(ex("a"), ex("b"), deString),
                    new Statement(ex("a"), ex("b"), nlString),
                    new Statement(ex("a"), ex("b"), ex("d")),
                ], langs),
            ).toEqual(nlString);
        });

        it("returns the first if no match could be fount", () => {
            expect(
                getPropBestLang([
                    new Statement(ex("a"), ex("b"), ex("c")),
                    new Statement(ex("a"), ex("b"), ex("d")),
                ], langs),
            ).toEqual(ex("c"));
        });
    });

    describe("#getPropBestLangRaw", () => {
        const langs = ["en", "nl", "de", "fr"];
        const deStmt = new Statement(ex("a"), ex("b"), new Literal("Wert", "de"));
        const enStmt = new Statement(ex("a"), ex("b"), new Literal("value", "en"));
        const nlStmt = new Statement(ex("a"), ex("b"), new Literal("waarde", "nl"));

        it("returns when a single statement is given", () => {
            expect(getPropBestLangRaw(nlStmt, langs)).toEqual(nlStmt);
        });

        it("returns when a single statement arr is given", () => {
            expect(getPropBestLangRaw([nlStmt], langs)).toEqual(nlStmt);
        });

        it("returns the correct language when present", () => {
            expect(
                getPropBestLangRaw([
                    nlStmt,
                    enStmt,
                    deStmt,
                ], langs),
            ).toEqual(enStmt);
        });

        it("returns the next best value when main is not present", () => {
            expect(
                getPropBestLangRaw([
                    new Statement(ex("a"), ex("b"), ex("c")),
                    deStmt,
                    nlStmt,
                    new Statement(ex("a"), ex("b"), ex("d")),
                ], langs),
            ).toEqual(nlStmt);
        });

        it("returns the first if no match could be fount", () => {
            const c = new Statement(ex("a"), ex("b"), ex("c"));
            const d = new Statement(ex("a"), ex("b"), ex("d"));
            expect(getPropBestLangRaw([c, d], langs)).toEqual(c);
        });
    });

    describe("#isDifferentOrigin", () => {
        it("is false on unresolvable values", () => {
            expect(isDifferentOrigin(new BlankNode())).toBeFalsy();
        });

        it("is false on the same origin", () => {
            expect(isDifferentOrigin(new NamedNode("http://example.org/test"))).toBeFalsy();
        });

        it("is true on a different origin", () => {
            expect(isDifferentOrigin(new NamedNode("http://example.com/test"))).toBeTruthy();
        });
    });

    describe("#namedNodeByIRI", () => {
        it("returns known iris from the map", () => {
            const name = defaultNS.schema("name");
            expect(namedNodeByIRI(name.value)).toEqual(name);
        });

        it("adds new IRI's to the map", () => {
            const added = namedNodeByIRI("http://new.example.org/test");
            expect(added).toHaveProperty("sI");
            expect(added).toHaveProperty("termType", "NamedNode");
            expect(added).toHaveProperty("term", "test");
        });
    });

    describe("#namedNodeByStoreIndex", () => {
        it("returns known iris from the map", () => {
            const name = defaultNS.schema("name");
            expect(namedNodeByStoreIndex(name.sI)).toEqual(name);
        });

        it("returns undefined for unknown values", () => {
            expect(namedNodeByStoreIndex(999999)).toBeUndefined();
        });
    });
});
