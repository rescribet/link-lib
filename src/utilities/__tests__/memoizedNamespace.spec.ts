import "../../__tests__/useHashFactory";

import rdfFactory from "@ontologies/core";

import ex from "../../ontology/ex";
import { NamedNode } from "../../rdf";
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
            expect(expandProperty(n)).toEqual(ex.ns("1"));
        });

        it("returns a NamedNode when passed a plain NN object with prototype interface properties", () => {
            const proto = { termType: "NamedNode" };
            const n = Object.create(proto);
            n.value = "http://example.com/ns#1";

            expect(expandProperty(n)).toEqual(ex.ns("1"));
        });

        it("returns undefined when passed a random plain object", () => {
            const n = {
                termType: "Whatever",
                value: "http://example.com/ns#1",
            };
            expect(expandProperty((n as NamedNode))).toBeUndefined();
        });

        it("parses url strings to NamedNodes", () => {
            expect(expandProperty("http://example.com/ns#1")).toEqual(ex.ns("1"));
        });

        it("parses n-quads formatted strings to NamedNodes", () => {
            expect(expandProperty("<http://example.com/ns#1>")).toEqual(ex.ns("1"));
        });

        it("parses shorthand strings to NamedNodes", () => {
            expect(expandProperty("ex:1", { ex })).toEqual(ex.ns("1"));
        });
    });
});
