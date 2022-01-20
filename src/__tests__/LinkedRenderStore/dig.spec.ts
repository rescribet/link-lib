import "jest";
import "../useHashFactory";

import rdfFactory, { NamedNode } from "@ontologies/core";

import { getBasicStore } from "../../testUtilities";

import { ex } from "./fixtures";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();

describe("LinkedRenderStore", () => {
    describe("#dig", () => {
        const store = getBasicStore();
        const start = ex("1");
        const bn = rdfFactory.blankNode();
        store.store.addQuads([
            [start, ex("oneToOne"), ex("1.1"), defaultGraph],

            [start, ex("oneToOneLiteral"), ex("1.2"), defaultGraph],

            [start, ex("oneToOneBN"), bn, defaultGraph],

            [start, ex("oneToOneMissing"), ex("1.3"), defaultGraph],

            [start, ex("oneToMany"), ex("1.4"), defaultGraph],
            [start, ex("oneToMany"), ex("1.5"), defaultGraph],

            [start, ex("oneToManyHoley"), ex("1.6"), defaultGraph],
            [start, ex("oneToManyHoley"), ex("1.7"), defaultGraph],
            [start, ex("oneToManyHoley"), ex("1.8"), defaultGraph],

            [ex("1.2"), ex("p"), rdfFactory.literal("value", "en"), defaultGraph],

            [bn, ex("p"), rdfFactory.literal("test"), defaultGraph],

            [ex("1.2"), ex("p"), rdfFactory.literal("value", "nl"), defaultGraph],

            [ex("1.2"), ex("p"), ex("2.3"), defaultGraph],

            [ex("1.4"), ex("p"), ex("2.4"), defaultGraph],
            [ex("1.5"), ex("p"), ex("2.5"), defaultGraph],

            [ex("1.6"), ex("p"), ex("2.6"), defaultGraph],
            [ex("1.7"), ex("p"), ex("2.7"), defaultGraph],
            [ex("1.8"), ex("p"), ex("2.8"), defaultGraph],

            [ex("2.6"), ex("q"), ex("3.6"), defaultGraph],
            [ex("2.7"), ex("other"), ex("3.7"), defaultGraph],
            [ex("2.8"), ex("q"), ex("3.8"), defaultGraph],
        ]);
        store.store.flush();

        it("is empty without path", () => expect(store.lrs.dig(start, [])).toEqual([]));

        it("resolves oneToOne", () => expect(store.lrs.dig(start, [ex("oneToOne")])).toEqual([ex("1.1")]));

        it("resolves literals through oneToOne", () => {
            expect(store.lrs.dig(start, [ex("oneToOneLiteral"), ex("p")]))
                .toEqual([
                    rdfFactory.literal("value", "en"),
                    rdfFactory.literal("value", "nl"),
                    ex("2.3"),
                ]);
        });

        it("resolves blank nodes through oneToOne", () => {
            expect(store.lrs.dig(start, [ex("oneToOneBN"), ex("p")]))
                .toEqual([rdfFactory.literal("test")]);
        });

        it("resolves oneToMany", () => {
            expect(store.lrs.dig(start, [ex("oneToMany")]))
                .toEqual([ex("1.4"), ex("1.5")]);
        });

        it("resolves values through oneToMany", () => {
            expect(store.lrs.dig(start, [ex("oneToMany"), ex("p")]))
                .toEqual([ex("2.4"), ex("2.5")]);
        });

        it("resolves values through holey oneToMany", () => {
            const [terms, subjects] = store.lrs.digDeeper(start, [ex("oneToManyHoley"), ex("p"), ex("q")]);

            expect(terms).toEqual([
              [ex("2.6"), ex("q"), ex("3.6"), defaultGraph],
              [ex("2.8"), ex("q"), ex("3.8"), defaultGraph],
            ]);
            expect(subjects).toEqual([
                start,
                ex("1.6"),
                ex("2.6"),
                ex("1.7"),
                ex("2.7"),
                ex("1.8"),
                ex("2.8"),
            ]);
        });

        it("resolves empty through holey oneToMany without end value", () => {
            expect(store.lrs.dig(start, [ex("oneToManyHoley"), ex("p"), ex("nonexistent")]))
                .toEqual([]);
        });
    });
});
