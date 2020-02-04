/* @globals set, generator, init */
import "../../__tests__/useHashFactory";

import rdfFactory, { HexPos, isBlankNode } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import schema from "@ontologies/schema";
import xsd from "@ontologies/xsd";
import "jest";

import ll from "../../ontology/ll";
import { Node } from "../../rdf";
import RDFIndex from "../../store/RDFIndex";

import { defaultNS } from "../../utilities/constants";

import { dataToGraphTuple, list, processObject, seq, toGraph } from "../DataToGraph";

describe("DataToGraph", () => {
    it("returns empty objects without data", () => {
        const [graph, blobs] = dataToGraphTuple({});
        expect(graph.quads).toHaveLength(0);
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

            expect(iri).toEqual("https://example.com/1");
        });

        it("creates a blank node when no IRI was given", () => {
            const [iri] = toGraph({});

            expect(isBlankNode(iri)).toBeTruthy();
        });

        it("allows a custom graph to be passed", () => {
            const g = new RDFIndex();
            const [, graph] = toGraph({}, undefined, g);

            expect(graph).toEqual(g);
        });
    });

    describe("uri parsing", () => {
        it("handles uri strings", () => {
            const [graph, blobs] = dataToGraphTuple({ "http://schema.org/name": "Some name" });
            expect(graph.quads).toHaveLength(1);
            expect(blobs).toHaveLength(0);

            const name = graph.quads[0];
            expect(name).toBeTruthy();
            expect(name[HexPos.subject]).toEqual(ll.targetResource);
            expect(name[HexPos.predicate]).toEqual(schema.name);
            const [v, dt, l] = rdfFactory.literal("Some name");
            expect(name[HexPos.object]).toEqual(v);
            expect(name[HexPos.objectDT]).toEqual(dt);
            expect(name[HexPos.objectLang]).toEqual(l);
        });

        it("handles shortened strings", () => {
            const [graph, blobs] = dataToGraphTuple({ "http://schema.org/name": "Some name" });
            expect(graph.quads).toHaveLength(1);
            expect(blobs).toHaveLength(0);

            const name = graph.quads[0];
            expect(name).toBeTruthy();
            expect(name[HexPos.subject]).toEqual(ll.targetResource);
            expect(name[HexPos.predicate]).toEqual(schema.name);
            const [v, dt, l] = rdfFactory.literal("Some name");
            expect(name[HexPos.object]).toEqual(v);
            expect(name[HexPos.objectDT]).toEqual(dt);
            expect(name[HexPos.objectLang]).toEqual(l);
        });

        it("raises on bad strings", () => {
            expect(() => {
                dataToGraphTuple({ schema_name: "Some name" });
            }).toThrow();
        });
    });

    describe("data type conversions", () => {
        it("handles arrays", () => {
            const data = { "http://www.example.com/property": [
                {
                    "@id": defaultNS.example("nested"),
                    "http://www.example.com/nestedProp": "1",
                },
                2,
                schema.name,
            ]};
            const [graph] = dataToGraphTuple(data);

            const stmts = graph.matchHex(
                ll.targetResource,
                defaultNS.example("property"),
                null,
                null,
                null,
                null,
            );
            expect(stmts).toHaveLength(3);

            const bn = stmts[0]!;
            expect(bn[HexPos.subject]).toEqual(ll.targetResource);
            expect(bn[HexPos.predicate]).toEqual(defaultNS.example("property"));
            expect(bn[HexPos.object]).toEqual(defaultNS.example("nested"));

            const nestedProp = graph.matchHex(
                bn[HexPos.object],
                defaultNS.example("nestedProp"),
                null,
                null,
                null,
                null,
            );
            expect(nestedProp).toHaveLength(1);
            expect(nestedProp[0][HexPos.objectDT]).toEqual(xsd.string);
            expect(nestedProp[0][HexPos.object]).toEqual("1");

            const nn = stmts[2]!;
            expect(nn[HexPos.subject]).toEqual(ll.targetResource);
            expect(nn[HexPos.predicate]).toEqual(defaultNS.example("property"));
            expect(nn[HexPos.objectDT]).toEqual(rdf.ns("namedNode"));
            expect(nn[HexPos.object]).toEqual("http://schema.org/name");

            const lit = stmts[1]!;
            expect(lit[HexPos.subject]).toEqual(ll.targetResource);
            expect(lit[HexPos.predicate]).toEqual(defaultNS.example("property"));
            expect(lit[HexPos.objectDT]).toEqual(xsd.integer);
            expect(lit[HexPos.object]).toEqual("2");
        });

        it("handles booleans", () => {
            const data = { "http://www.example.com/property": true };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt[HexPos.subject]).toEqual(ll.targetResource);
            expect(stmt[HexPos.predicate]).toEqual(defaultNS.example("property"));
            const [v, dt, l] = rdfFactory.literal(true);
            expect(stmt[HexPos.object]).toEqual(v);
            expect(stmt[HexPos.objectDT]).toEqual(dt);
            expect(stmt[HexPos.objectLang]).toEqual(l);
        });

        it("handles dates", () => {
            const data = { "http://www.example.com/property": new Date() };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt[HexPos.subject]).toEqual(ll.targetResource);
            expect(stmt[HexPos.predicate]).toEqual(defaultNS.example("property"));
            const [v, dt, l] = rdfFactory.literal(data["http://www.example.com/property"]);
            expect(stmt[HexPos.object]).toEqual(v);
            expect(stmt[HexPos.objectDT]).toEqual(dt);
            expect(stmt[HexPos.objectLang]).toEqual(l);
        });

        it("handles decimals", () => {
            const data = { "http://www.example.com/property": 2.5 };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt[HexPos.subject]).toEqual(ll.targetResource);
            expect(stmt[HexPos.predicate]).toEqual(defaultNS.example("property"));
            const [v, dt, l] = rdfFactory.literal(2.5);
            expect(stmt[HexPos.object]).toEqual(v);
            expect(stmt[HexPos.objectDT]).toEqual(dt);
            expect(stmt[HexPos.objectLang]).toEqual(l);
        });

        it("handles files", () => {
            const data = { "http://www.example.com/property": new File([""], "test.txt") };
            const [graph, blobs] = dataToGraphTuple(data);
            expect(blobs).toHaveLength(1);
            const fileNode = blobs[0][0];

            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt[HexPos.subject]).toEqual(ll.targetResource);
            expect(stmt[HexPos.predicate]).toEqual(defaultNS.example("property"));
            expect(stmt[HexPos.object]).toEqual(fileNode);
        });

        it("handles integers", () => {
            const data = { "http://www.example.com/property": 45 };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt[HexPos.subject]).toEqual(ll.targetResource);
            expect(stmt[HexPos.predicate]).toEqual(defaultNS.example("property"));
            const [v, dt, l] = rdfFactory.literal(45);
            expect(stmt[HexPos.object]).toEqual(v);
            expect(stmt[HexPos.objectDT]).toEqual(dt);
            expect(stmt[HexPos.objectLang]).toEqual(l);
        });

        it("handles bigints", () => {
            const value = "1000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
            const data = { "http://www.example.com/property": BigInt(value) as unknown as number };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt[HexPos.subject]).toEqual(ll.targetResource);
            expect(stmt[HexPos.predicate]).toEqual(defaultNS.example("property"));
            const [v, dt, l] = rdfFactory.literal(value, xsd.integer);
            expect(stmt[HexPos.object]).toEqual(v);
            expect(stmt[HexPos.objectDT]).toEqual(dt);
            expect(stmt[HexPos.objectLang]).toEqual(l);
        });

        it("handles nested resources", () => {
            const data = {
                "http://www.example.com/property": {
                    "http://schema.org/name": "Some string",
                    "http://www.example.com/file": new File([""], "test.txt"),
                },
            };
            const [graph, blobs] = dataToGraphTuple(data);
            expect(blobs).toHaveLength(1);
            expect(graph.quads).toHaveLength(3);

            const stmt = graph.matchHex(
                ll.targetResource,
                defaultNS.example("property"),
                null,
                null,
                null,
                null,
                true,
            )?.[0];
            expect(stmt).toBeTruthy();
            expect(stmt[HexPos.subject]).toEqual(ll.targetResource);
            expect(stmt[HexPos.predicate]).toEqual(defaultNS.example("property"));
            expect(stmt[HexPos.objectDT]).toEqual(rdf.ns("blankNode"));

            const match = rdfFactory.quad(
                (stmt[HexPos.object] as Node),
                schema.name,
                rdfFactory.literal("Some string"),
            );
            expect(graph.holdsQuad(match)).toBeTruthy();
        });

        it("handles strings", () => {
            const data = { "http://www.example.com/property": "Some string" };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.quads[0];
            expect(stmt).toBeTruthy();
            expect(stmt[HexPos.subject]).toEqual(ll.targetResource);
            expect(stmt[HexPos.predicate]).toEqual(defaultNS.example("property"));
            const [v, dt, l] = rdfFactory.literal("Some string")
            expect(stmt[HexPos.object]).toEqual(v);
            expect(stmt[HexPos.objectDT]).toEqual(dt);
            expect(stmt[HexPos.objectLang]).toEqual(l);
        });
    });

    describe("processObject", () => {
        it("handles undefined", () => {
            const g = new RDFIndex();
            processObject(defaultNS.example("a"), defaultNS.example("property"), null, g);
            expect(g.quads).toHaveLength(0);
        });

        it("handles null", () => {
            const g = new RDFIndex();
            processObject(defaultNS.example("a"), defaultNS.example("property"), null, g);
            expect(g.quads).toHaveLength(0);
        });

        it("handles rdf literals", () => {
            const g = new RDFIndex();
            processObject(defaultNS.example("a"), defaultNS.example("property"), rdfFactory.literal(1), g);
            expect(g.quads).toHaveLength(1);
            const [v, dt, l] = rdfFactory.literal(1);
            expect(g.quads[0][HexPos.object]).toEqual(v);
            expect(g.quads[0][HexPos.objectDT]).toEqual(dt);
            expect(g.quads[0][HexPos.objectLang]).toEqual(l);
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
