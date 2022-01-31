import "./useFactory";

import rdfFactory, { NamedNode, Quadruple } from "@ontologies/core";
import * as rdfx from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";
import "jest";

import example from "../ontology/example";
import {
    allRDFPropertyStatements,
    allRDFValues,
    anyRDFValue,
    getPropBestLang,
    getPropBestLangRaw,
    getTermBestLang,
    isDifferentOrigin,
    sortByBestLang,
} from "../utilities";

const ex = example.ns;
const defaultGraph: NamedNode = rdfFactory.defaultGraph();

describe("utilities", () => {
    const abc: Quadruple = [ex("a"), ex("b"), ex("c"), defaultGraph];
    const dpe: Quadruple = [ex("d"), ex("p"), ex("e"), defaultGraph];
    const dpn: Quadruple = [ex("d"), ex("p"), ex("n"), defaultGraph];

    describe("#allRDFPropertyStatements", () => {
        it("returns an empty array when undefined is passed", () => {
            expect(allRDFPropertyStatements(undefined, ex("p"))).toHaveLength(0);
        });

        it("returns an empty array when no statements were passed", () => {
            expect(allRDFPropertyStatements([], ex("p"))).toHaveLength(0);
        });

        it("returns an empty array when no matches were found", () => {
            const stmts: Quadruple[] = [
                abc,
                dpe,
                [ex("f"), ex("g"), ex("h"), defaultGraph],
                dpn,
                [ex("f"), ex("g"), ex("x"), defaultGraph],
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
                [ex("a"), ex("p"), ex("b"), defaultGraph],
                [ex("c"), ex("p"), ex("d"), defaultGraph],
            ], ex("p"))).toHaveLength(2);
        });

        it("returns all rdfs:member properties", () => {
            const stmts: Quadruple[] = [
                abc,
                [ex("c"), rdfx.ns("_1"), ex("1"), defaultGraph],
                [ex("c"), rdfx.ns("_0"), ex("0"), defaultGraph],
                [ex("c"), rdfx.ns("_2"), ex("2"), defaultGraph],
                [ex("c"), rdfx.ns("_3"), ex("3"), defaultGraph],
                [ex("c"), rdfx.ns("_5"), ex("5"), defaultGraph],
                [ex("c"), rdfs.member, ex("6"), defaultGraph],
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
            const stmts: Quadruple[] = [
                abc,
                [ex("c"), ex("b"), ex("d"), defaultGraph],
                [ex("d"), ex("h"), ex("f"), defaultGraph],
                [ex("d"), ex("b"), ex("g"), defaultGraph],
            ];
            expect(anyRDFValue(stmts, ex("b"))).toEqual(ex("c"));
        });

        it("returns all rdfs:member properties", () => {
            const stmts: Quadruple[] = [
                abc,
                [ex("c"), rdfx.ns("_1"), ex("1"), defaultGraph],
                [ex("c"), rdfx.ns("_0"), ex("0"), defaultGraph],
                [ex("c"), rdfx.ns("_2"), ex("2"), defaultGraph],
            ];
            expect(anyRDFValue(stmts, rdfs.member)).toEqual(ex("1"));
        });
    });

    describe("#getPropBestLang", () => {
        const langs = ["en", "nl", "de", "fr"];
        const deString = rdfFactory.literal("Wert", "de");
        const enString = rdfFactory.literal("value", "en");
        const nlString = rdfFactory.literal("waarde", "nl");

        const abnl: Quadruple = [ex("a"), ex("b"), nlString, defaultGraph];
        const aben: Quadruple = [ex("a"), ex("b"), enString, defaultGraph];
        const abde: Quadruple = [ex("a"), ex("b"), deString, defaultGraph];
        const abd: Quadruple = [ex("a"), ex("b"), ex("d"), defaultGraph];

        it("returns when a single statement arr is given", () => {
            expect(getPropBestLang([abnl], langs)).toEqual(nlString);
        });

        it("returns the correct language when present", () => {
            expect(getPropBestLang([abnl, aben, abde], langs)).toEqual(enString);
        });

        it("returns the next best value when main is not present", () => {
            expect(getPropBestLang([abc, abde, abnl, abd], langs)).toEqual(nlString);
        });

        it("returns the first if no match could be found", () => {
            expect(getPropBestLang([abc, abd], langs)).toEqual(ex("c"));
        });
    });

    describe("#getPropBestLangRaw", () => {
        const langs = ["en", "nl", "de", "fr"];
        const deStmt: Quadruple = [ex("a"), ex("b"), rdfFactory.literal("Wert", "de"), defaultGraph];
        const enStmt: Quadruple = [ex("a"), ex("b"), rdfFactory.literal("value", "en"), defaultGraph];
        const nlStmt: Quadruple = [ex("a"), ex("b"), rdfFactory.literal("waarde", "nl"), defaultGraph];

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

        it("returns the first if no match could be found", () => {
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
            expect(isDifferentOrigin(rdfFactory.namedNode("http://example.org/test"))).toBeFalsy();
        });

        it("is true on a different origin", () => {
            expect(isDifferentOrigin(rdfFactory.namedNode("http://example.com/test"))).toBeTruthy();
        });
    });

    describe("#sortByBestLang", () => {
        const langs = ["en", "nl", "de", "fr"];
        const deStmt: Quadruple = [ex("a"), ex("b"), rdfFactory.literal("Wert", "de"), defaultGraph];
        const enStmt: Quadruple = [ex("a"), ex("b"), rdfFactory.literal("value", "en"), defaultGraph];
        const nlStmt: Quadruple = [ex("a"), ex("b"), rdfFactory.literal("waarde", "nl"), defaultGraph];

        it("returns when a single statement arr is given", () => {
            expect(sortByBestLang([nlStmt], langs)).toEqual([nlStmt]);
        });

        it("returns the correct language when present", () => {
            expect(sortByBestLang([nlStmt, enStmt, deStmt], langs)).toEqual([enStmt, nlStmt, deStmt]);
        });

        it("returns the next best value when main is not present", () => {
            expect(
              sortByBestLang([
                  abc,
                  deStmt,
                  nlStmt,
                  [ex("a"), ex("b"), ex("d"), defaultGraph],
              ], langs),
            ).toEqual([
                nlStmt,
                deStmt,
                abc,
                [ex("a"), ex("b"), ex("d"), defaultGraph],
            ]);
        });

        it("returns identity if no match could be found", () => {
            const c = abc;
            const d: Quadruple = [ex("a"), ex("b"), ex("d"), defaultGraph];
            expect(sortByBestLang([c, d], langs)).toEqual([c, d]);
        });
    });

    describe("#namedNodeByIRI", () => {
        it("returns known iris from the map", () => {
            const name = schema.name;
            expect(rdfFactory.namedNode(name.value)).toEqual(name);
        });

        it("adds new IRI's to the map", () => {
            const added = rdfFactory.namedNode("http://new.example.org/test", "test");
            expect(added).toHaveProperty("termType", "NamedNode");
            // expect(added).toHaveProperty("term", "test");
            expect(added).toHaveProperty("id");
            expect(rdfFactory.memoizationMap[rdfFactory.id(added)]).toEqual(added);
        });
    });

    describe("#namedNodeByStoreIndex", () => {
        it("returns known iris from the map", () => {
            const name = schema.name;
            expect(rdfFactory.fromId(rdfFactory.id(name))).toEqual(name);
        });

        it("returns undefined for unknown values", () => {
            expect(rdfFactory.fromId(999999)).toBeUndefined();
        });
    });
});
