import "../../__tests__/useHashFactory";

import rdfFactory from "@ontologies/core";

import { NamedNode } from "../../rdf";
import { defaultNS as NS } from "../../utilities/constants";
import { expandProperty } from "../memoizedNamespace";

describe("memoizedNamespace", () => {
    describe("expandProperty", () => {
        it("returns identity when passed undefined", () => {
            expect(expandProperty(undefined)).toBeUndefined();
        });

        it("returns identity when passed NamedNode", () => {
            const n = rdfFactory.namedNode("http://example.com");
            expect(expandProperty(n)).toEqual(n);
        });

        it("returns a NamedNode when passed a plain NN object", () => {
            const n = {
                termType: "NamedNode",
                value: "http://example.com/ns#1",
            };
            expect(expandProperty(n)).toEqual(NS.ex("1"));
        });

        it("returns undefined when passed a random plain object", () => {
            const n = {
                termType: "Whatever",
                value: "http://example.com/ns#1",
            };
            expect(expandProperty((n as NamedNode))).toBeUndefined();
        });

        it("parses url strings to NamedNodes", () => {
            expect(expandProperty("http://example.com/ns#1")).toEqual(NS.ex("1"));
        });

        it("parses shorthand strings to NamedNodes", () => {
            expect(expandProperty("ex:1")).toEqual(NS.ex("1"));
        });
    });
});
