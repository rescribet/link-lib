import "../../__tests__/useFactory";

import rdfFactory from "@ontologies/core";
import "jest";

import { isGlobalId, isLocalId, mergeTerms } from "../slices";

describe("slices", () => {
    describe("isLocalId", () => {
        it("detects local ids", () => {
            expect(isLocalId("_:b123")).toEqual(true);
        });

        it("rejects global ids", () => {
            expect(isLocalId("http://example.com/test:_")).toEqual(false);
        });
    });

    describe("isGlobalId", () => {
        it("rejects local ids", () => {
            expect(isGlobalId("_:b123")).toEqual(false);
        });

        it("detects fully qualified global ids", () => {
            expect(isGlobalId("http://example.com/test:_")).toEqual(true);
        });

        it("detects absolute global ids", () => {
            expect(isGlobalId("/test:_")).toEqual(true);
        });
    });

    describe("mergeTerms", () => {
        const a = rdfFactory.blankNode();
        const b = rdfFactory.blankNode();
        const c = rdfFactory.blankNode();

        it("merges nodes", () => {
            expect(mergeTerms(a, b)).toEqual([a, b]);
        });

        it("collapses undefined start", () => {
            expect(mergeTerms(undefined, b)).toEqual(b);
        });

        it("removes duplicates", () => {
            expect(mergeTerms(b, b)).toEqual([b]);
        });

        it("merges multimap", () => {
            expect(mergeTerms([a, b], c)).toEqual([a, b, c]);
        });
    });
});
