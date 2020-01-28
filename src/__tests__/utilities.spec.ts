import "./useHashFactory";

import rdfFactory from "@ontologies/core";
import rdfx from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import "jest";

import {
    allRDFPropertyStatements,
    allRDFValues,
    anyRDFValue,
    getPropBestLang,
    getPropBestLangRaw,
    getTermBestLang,
    isDifferentOrigin,
} from "../utilities";
import { defaultNS } from "../utilities/constants";

const ex = defaultNS.example;

describe("utilities", () => {
    const abc = rdfFactory.quad(ex("a"), ex("b"), ex("c"));
    const dpe = rdfFactory.quad(ex("d"), ex("p"), ex("e"));
    const dpn = rdfFactory.quad(ex("d"), ex("p"), ex("n"));

    describe("#allRDFPropertyStatements", () => {
        it("returns an empty array when undefined is passed", () => {
            expect(allRDFPropertyStatements(undefined, ex("p"))).toHaveLength(0);
        });

        it("returns an empty array when no statements were passed", () => {
            expect(allRDFPropertyStatements([], ex("p"))).toHaveLength(0);
        });

        it("returns an empty array when no matches were found", () => {
            const stmts = [
                abc,
                dpe,
                rdfFactory.quad(ex("f"), ex("g"), ex("h")),
                dpn,
                rdfFactory.quad(ex("f"), ex("g"), ex("x")),
            ];
            expect(allRDFPropertyStatements(stmts, ex("p"))).toEqual([
                dpe,
                dpn,
            ]);
        });
    });

    describe("#allRDFValues", () => {
        it("returns an empty array without matches", () => {
            expect(allRDFValues([], ex("p"))).toHaveLength(0);
        });

        it("returns an empty array without matches", () => {
            expect(allRDFValues([
                rdfFactory.quad(ex("a"), ex("p"), ex("b")),
                rdfFactory.quad(ex("c"), ex("p"), ex("d")),
            ], ex("p"))).toHaveLength(2);
        });

        it("returns all rdfs:member properties", () => {
            const stmts = [
                abc,
                rdfFactory.quad(ex("c"), rdfx.ns("_1"), ex("1")),
                rdfFactory.quad(ex("c"), rdfx.ns("_0"), ex("0")),
                rdfFactory.quad(ex("c"), rdfx.ns("_2"), ex("2")),
                rdfFactory.quad(ex("c"), rdfx.ns("_3"), ex("3")),
                rdfFactory.quad(ex("c"), rdfx.ns("_5"), ex("5")),
                rdfFactory.quad(ex("c"), rdfs.member, ex("6")),
            ];
            expect(allRDFValues(stmts, rdfs.member))
                .toEqual([
                    ex("1"),
                    ex("0"),
                    ex("2"),
                    ex("3"),
                    ex("5"),
                    ex("6"),
                ]);
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
                abc,
                rdfFactory.quad(ex("c"), ex("b"), ex("d")),
                rdfFactory.quad(ex("d"), ex("h"), ex("f")),
                rdfFactory.quad(ex("d"), ex("b"), ex("g")),
            ];
            expect(anyRDFValue(stmts, ex("b"))).toEqual(ex("c"));
        });

        it("returns all rdfs:member properties", () => {
            const stmts = [
                abc,
                rdfFactory.quad(ex("c"), rdfx.ns("_1"), ex("1")),
                rdfFactory.quad(ex("c"), rdfx.ns("_0"), ex("0")),
                rdfFactory.quad(ex("c"), rdfx.ns("_2"), ex("2")),
            ];
            expect(anyRDFValue(stmts, rdfs.member)).toEqual(ex("1"));
        });
    });

    describe("#getPropBestLang", () => {
        const langs = ["en", "nl", "de", "fr"];
        const deString = rdfFactory.literal("Wert", "de");
        const enString = rdfFactory.literal("value", "en");
        const nlString = rdfFactory.literal("waarde", "nl");

        const abnl = rdfFactory.quad(ex("a"), ex("b"), nlString);
        const aben = rdfFactory.quad(ex("a"), ex("b"), enString);
        const abde = rdfFactory.quad(ex("a"), ex("b"), deString);
        const abd = rdfFactory.quad(ex("a"), ex("b"), ex("d"));

        it("returns when a single statement is given", () => {
            expect(getPropBestLang(abnl, langs)).toEqual(nlString);
        });

        it("returns when a single statement arr is given", () => {
            expect(getPropBestLang([abnl], langs)).toEqual(nlString);
        });

        it("returns the correct language when present", () => {
            expect(getPropBestLang([abnl, aben, abde], langs)).toEqual(enString);
        });

        it("returns the next best value when main is not present", () => {
            expect(getPropBestLang([abc, abde, abnl, abd], langs)).toEqual(nlString);
        });

        it("returns the first if no match could be fount", () => {
            expect(getPropBestLang([abc, abd], langs)).toEqual(ex("c"));
        });
    });

    describe("#getPropBestLangRaw", () => {
        const langs = ["en", "nl", "de", "fr"];
        const deStmt = rdfFactory.quad(ex("a"), ex("b"), rdfFactory.literal("Wert", "de"));
        const enStmt = rdfFactory.quad(ex("a"), ex("b"), rdfFactory.literal("value", "en"));
        const nlStmt = rdfFactory.quad(ex("a"), ex("b"), rdfFactory.literal("waarde", "nl"));

        it("returns when a single statement is given", () => {
            expect(getPropBestLangRaw(nlStmt, langs)).toEqual(nlStmt);
        });

        it("returns when a single statement arr is given", () => {
            expect(getPropBestLangRaw([nlStmt], langs)).toEqual(nlStmt);
        });

        it("returns the correct language when present", () => {
            expect(getPropBestLangRaw([nlStmt, enStmt, deStmt], langs)).toEqual(enStmt);
        });

        it("returns the next best value when main is not present", () => {
            expect(
                getPropBestLangRaw([
                    abc,
                    deStmt,
                    nlStmt,
                    rdfFactory.quad(ex("a"), ex("b"), ex("d")),
                ], langs),
            ).toEqual(nlStmt);
        });

        it("returns the first if no match could be fount", () => {
            const c = abc;
            const d = rdfFactory.quad(ex("a"), ex("b"), ex("d"));
            expect(getPropBestLangRaw([c, d], langs)).toEqual(c);
        });
    });

    describe("getTermBestLang", () => {
        const langs = ["en", "nl", "de", "fr"];
        const deString = rdfFactory.literal("Wert", "de");
        const enString = rdfFactory.literal("value", "en");
        const nlString = rdfFactory.literal("waarde", "nl");

        it("returns plain terms", () => {
            expect(getTermBestLang(deString, langs)).toEqual(deString);
        });

        it("returns the only term", () => {
            expect(getTermBestLang([enString], langs)).toEqual(enString);
        });

        it("selects the preferred term", () => {
            expect(getTermBestLang([deString, enString, nlString], langs)).toEqual(enString);
        });

        it("returns the first if no match was found", () => {
            expect(getTermBestLang([deString, enString, nlString], ["fr"])).toEqual(deString);
        });
    });

    describe("#isDifferentOrigin", () => {
        it("is false on unresolvable values", () => {
            expect(isDifferentOrigin(rdfFactory.blankNode())).toBeFalsy();
        });
        it("is false on the same origin", () => {
            expect(isDifferentOrigin("http://example.org/test")).toBeFalsy();
        });

        it("is true on a different origin", () => {
            expect(isDifferentOrigin("http://example.com/test")).toBeTruthy();
        });
    });
});
