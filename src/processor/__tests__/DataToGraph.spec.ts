/* @globals set, generator, init */
import "../../__tests__/useHashFactory";

import rdfFactory, { TermType } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import schema from "@ontologies/schema";
import "jest";

import { rdflib } from "../../link-lib";
import { Node } from "../../rdf";

import { defaultNS } from "../../utilities/constants";

import { dataToGraphTuple, list, processObject, seq, toGraph } from "../DataToGraph";

describe("DataToGraph", () => {
    it("returns empty objects without data", () => {
        const [graph, blobs] = dataToGraphTuple({});
        expect(graph.statements).toHaveLength(0);
        expect(blobs).toHaveLength(0);
    });

    describe("IRIs", () => {
        it("raises when only an IRI was given", () => {
            expect(() => {
                toGraph(defaultNS.example("r"));
            }).toThrowError(TypeError);
        });

        it("raises when embedded is not a string", () => {
            expect(() => {
                toGraph({
                    "@id": 1,
                });
            }).toThrowError(TypeError);
        });

        it("parses an embedded iri", () => {
            const [iri] = toGraph({ "@id": "https://example.com/1" });

            expect(iri).toEqual(rdfFactory.namedNode("https://example.com/1"));
        });

        it("creates a blank node when no IRI was given", () => {
            const [iri] = toGraph({});

            expect(iri.termType).toEqual(TermType.BlankNode);
        });

        it("allows a custom graph to be passed", () => {
            const g = new rdflib.IndexedFormula();
            const [, graph] = toGraph({}, undefined, g);

            expect(graph).toEqual(g);
        });
    });

    describe("uri parsing", () => {
        it("handles uri strings", () => {
            const [graph, blobs] = dataToGraphTuple({ "http://schema.org/name": "Some name" });
            expect(graph.statements).toHaveLength(1);
            expect(blobs).toHaveLength(0);

            const name = graph.statements[0];
            expect(name).toBeTruthy();
            expect(name.subject).toEqual(defaultNS.ll("targetResource"));
            expect(name.predicate).toEqual(schema.name);
            expect(name.object).toEqual(rdfFactory.literal("Some name"));
        });

        it("handles shortened strings", () => {
            const [graph, blobs] = dataToGraphTuple({ "schema:name": "Some name" });
            expect(graph.statements).toHaveLength(1);
            expect(blobs).toHaveLength(0);

            const name = graph.statements[0];
            expect(name).toBeTruthy();
            expect(name.subject).toEqual(defaultNS.ll("targetResource"));
            expect(name.predicate).toEqual(schema.name);
            expect(name.object).toEqual(rdfFactory.literal("Some name"));
        });

        it("raises on bad strings", () => {
            expect(() => {
                dataToGraphTuple({ schema_name: "Some name" });
            }).toThrow();
        });
    });

    describe("data type conversions", () => {
        it("handles arrays", () => {
            const data = { "example:property": [
                {
                    "@id": defaultNS.example("nested"),
                    "example:nestedProp": "1",
                },
                2,
                schema.name,
            ]};
            const [graph] = dataToGraphTuple(data);

            const stmts = graph.statementsMatching(defaultNS.ll("targetResource"), defaultNS.example("property"));
            expect(stmts).toHaveLength(3);

            const bn = stmts[0]!;
            expect(bn.subject).toEqual(defaultNS.ll("targetResource"));
            expect(bn.predicate).toEqual(defaultNS.example("property"));
            expect(bn.object).toEqual(defaultNS.example("nested"));

            const nestedProp = graph.statementsMatching(bn.object as Node, defaultNS.example("nestedProp"));
            expect(nestedProp).toHaveLength(1);
            expect(nestedProp[0].object.termType).toEqual("Literal");
            expect(nestedProp[0].object.value).toEqual("1");

            const nn = stmts[2]!;
            expect(nn.subject).toEqual(defaultNS.ll("targetResource"));
            expect(nn.predicate).toEqual(defaultNS.example("property"));
            expect(nn.object.termType).toEqual("NamedNode");
            expect(nn.object.value).toEqual("http://schema.org/name");

            const lit = stmts[1]!;
            expect(lit.subject).toEqual(defaultNS.ll("targetResource"));
            expect(lit.predicate).toEqual(defaultNS.example("property"));
            expect(lit.object.termType).toEqual("Literal");
            expect(lit.object.value).toEqual("2");
        });

        it("handles booleans", () => {
            const data = { "example:property": true };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.statements[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt.predicate).toEqual(defaultNS.example("property"));
            expect(stmt.object).toEqual(rdfFactory.literal(true));
        });

        it("handles dates", () => {
            const data = { "example:property": new Date() };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.statements[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt.predicate).toEqual(defaultNS.example("property"));
            expect(stmt.object).toEqual(rdfFactory.literal(data["example:property"]));
        });

        it("handles decimals", () => {
            const data = { "example:property": 2.5 };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.statements[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt.predicate).toEqual(defaultNS.example("property"));
            expect(stmt.object).toEqual(rdfFactory.literal(2.5));
        });

        it("handles files", () => {
            const data = { "example:property": new File([""], "test.txt") };
            const [graph, blobs] = dataToGraphTuple(data);
            expect(blobs).toHaveLength(1);
            const fileNode = blobs[0][0];

            const stmt = graph.statements[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt.predicate).toEqual(defaultNS.example("property"));
            expect(stmt.object).toEqual(fileNode);
        });

        it("handles integers", () => {
            const data = { "example:property": 45 };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.statements[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt.predicate).toEqual(defaultNS.example("property"));
            expect(stmt.object).toEqual(rdfFactory.literal(45));
        });

        it("handles nested resources", () => {
            const data = {
                "example:property": {
                    "example:file": new File([""], "test.txt"),
                    "schema:name": "Some string",
                },
            };
            const [graph, blobs] = dataToGraphTuple(data);
            expect(blobs).toHaveLength(1);
            expect(graph.statements).toHaveLength(3);

            const stmt = graph.anyStatementMatching(defaultNS.ll("targetResource"), defaultNS.example("property"));
            expect(stmt).toBeTruthy();
            expect(stmt!.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt!.predicate).toEqual(defaultNS.example("property"));
            expect(stmt!.object.termType).toEqual("BlankNode");

            const match = rdfFactory.quad(
                (stmt!.object as Node),
                schema.name,
                rdfFactory.literal("Some string"),
            );
            expect(graph.holdsStatement(match)).toBeTruthy();
        });

        it("handles strings", () => {
            const data = { "example:property": "Some string" };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.statements[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt.predicate).toEqual(defaultNS.example("property"));
            expect(stmt.object).toEqual(rdfFactory.literal("Some string"));
        });
    });

    describe("processObject", () => {
        it("handles undefined", () => {
            const g = new rdflib.IndexedFormula();
            processObject(defaultNS.example("a"), defaultNS.example("property"), null, g);
            expect(g.statements).toHaveLength(0);
        });

        it("handles null", () => {
            const g = new rdflib.IndexedFormula();
            processObject(defaultNS.example("a"), defaultNS.example("property"), null, g);
            expect(g.statements).toHaveLength(0);
        });

        it("handles rdf literals", () => {
            const g = new rdflib.IndexedFormula();
            processObject(defaultNS.example("a"), defaultNS.example("property"), rdfFactory.literal(1), g);
            expect(g.statements).toHaveLength(1);
            expect(g.statements[0].object).toEqual(rdfFactory.literal(1));
        });
    });

    describe("list", () => {
        it("returns an empty list for an empty array", () => {
            expect(list([])).toEqual(rdf.nil);
        });
    });

    describe("seq", () => {
        it("returns an empty sequence for an empty array", () => {
            expect(seq([])).toEqual({
                [rdf.type.toString()]: rdf.Seq,
            });
        });

        it("returns a sequence for an array", () => {
            const d = new Date();

            expect(seq([
                rdfFactory.literal(1),
                rdfFactory.literal("2"),
                rdfFactory.literal(d),
                defaultNS.ex("t"),
            ])).toEqual({
                [rdf.type.toString()]: rdf.Seq,
                [rdf.ns("_0").toString()]: rdfFactory.literal(1),
                [rdf.ns("_1").toString()]: rdfFactory.literal("2"),
                [rdf.ns("_2").toString()]: rdfFactory.literal(d),
                [rdf.ns("_3").toString()]: defaultNS.ex("t"),
            });
        });

        it("sets a given id", () => {
            const id = rdfFactory.blankNode();

            expect(seq([], id)).toHaveProperty("@id", id);
        });
    });
});
