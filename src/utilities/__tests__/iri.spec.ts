import "jest";
import "../../__tests__/useHashFactory";

import rdf from "@ontologies/core";
import { doc, parentDir } from "../iri";

const root = rdf.namedNode("http://example.com/");
const base = rdf.namedNode("http://example.com/page");
const frag = rdf.namedNode("http://example.com/page#test");
const nested1 = rdf.namedNode("http://example.com/page/sub");
const nested1Trailing = rdf.namedNode("http://example.com/page/sub/");
const nested2 = rdf.namedNode("http://example.com/page/sub/resource");
const nested2query = rdf.namedNode("http://example.com/page/sub/resource?test=true");

describe("iri", () => {
    describe("doc", () => {
        it("keeps document iris", () => {
            expect(doc(base)).toEqual(base);
        });

        it("removes the fragment", () => {
            expect(doc(frag)).toEqual(base);
        });
    });

    describe("parentDir", () => {
        it("resolves to subdir", () => {
            expect(parentDir(nested2)).toEqual(nested1);
        });

        it("resolves to base", () => {
            expect(parentDir(nested1)).toEqual(base);
        });

        it("resolves to base with trailing slash", () => {
            expect(parentDir(nested1Trailing)).toEqual(base);
        });

        it("resolves to base removing fragments", () => {
            expect(parentDir(frag)).toEqual(root);
        });

        it("removes query parameters", () => {
            expect(parentDir(nested2query)).toEqual(nested1);
        });
    });
});
