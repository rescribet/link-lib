/* @globals set, generator, init */
import "jest";
import {
    BlankNode,
    Collection,
    IndexedFormula,
    Literal,
    Statement,
} from "rdflib";

import { defaultNS } from "../../utilities/constants";

import { dataToGraphTuple, processObject } from "../DataToGraph";

describe("DataToGraph", () => {
    it("returns empty objects without data", () => {
        const [graph, blobs] = dataToGraphTuple({});
        expect(graph.statements).toHaveLength(0);
        expect(blobs).toHaveLength(0);
    });

    describe("uri parsing", () => {
        it("handles uri strings", () => {
            const [graph, blobs] = dataToGraphTuple({ "http://schema.org/name": "Some name" });
            expect(graph.statements).toHaveLength(1);
            expect(blobs).toHaveLength(0);

            const name = graph.statements[0];
            expect(name).toBeTruthy();
            expect(name.subject).toEqual(defaultNS.ll("targetResource"));
            expect(name.predicate).toEqual(defaultNS.schema("name"));
            expect(name.object).toEqual(Literal.find("Some name"));
        });

        it("handles shortened strings", () => {
            const [graph, blobs] = dataToGraphTuple({ "schema:name": "Some name" });
            expect(graph.statements).toHaveLength(1);
            expect(blobs).toHaveLength(0);

            const name = graph.statements[0];
            expect(name).toBeTruthy();
            expect(name.subject).toEqual(defaultNS.ll("targetResource"));
            expect(name.predicate).toEqual(defaultNS.schema("name"));
            expect(name.object).toEqual(Literal.find("Some name"));
        });

        it("raises on bad strings", () => {
            expect(() => {
                dataToGraphTuple({ schema_name: "Some name" });
            }).toThrow();
        });
    });

    describe("data type conversions", () => {
        it("handles arrays", () => {
            const data = { "example:property": ["1", 2, true] };
            const [graph] = dataToGraphTuple(data);

            const stmt = graph.anyStatementMatching(defaultNS.ll("targetResource"), defaultNS.example("property"));
            expect(stmt).toBeTruthy();
            expect(stmt!.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt!.predicate).toEqual(defaultNS.example("property"));
            expect(stmt!.object.termType).toEqual("Collection");
            expect((stmt!.object as Collection).closed).toBeTruthy();
        });

        it("handles booleans", () => {
            const data = { "example:property": true };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.statements[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt.predicate).toEqual(defaultNS.example("property"));
            expect(stmt.object).toEqual(Literal.fromBoolean(true));
        });

        it("handles dates", () => {
            const data = { "example:property": new Date() };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.statements[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt.predicate).toEqual(defaultNS.example("property"));
            expect(stmt.object).toEqual(Literal.fromDate(data["example:property"]));
        });

        it("handles decimals", () => {
            const data = { "example:property": 2.5 };
            const [graph] = dataToGraphTuple(data);
            const stmt = graph.statements[0];
            expect(stmt).toBeTruthy();
            expect(stmt.subject).toEqual(defaultNS.ll("targetResource"));
            expect(stmt.predicate).toEqual(defaultNS.example("property"));
            expect(stmt.object).toEqual(Literal.fromNumber(2.5));
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
            expect(stmt.object).toEqual(Literal.fromNumber(45));
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

            const match = new Statement(
                (stmt!.object as BlankNode),
                defaultNS.schema("name"),
                Literal.fromValue("Some string"),
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
            expect(stmt.object).toEqual(Literal.find("Some string"));
        });
    });

    describe("processObject", () => {
        it("handles undefined", () => {
            const g = new IndexedFormula();
            processObject(defaultNS.example("a"), defaultNS.example("property"), null, g);
            expect(g.statements).toHaveLength(0);
        });

        it("handles null", () => {
            const g = new IndexedFormula();
            processObject(defaultNS.example("a"), defaultNS.example("property"), null, g);
            expect(g.statements).toHaveLength(0);
        });
    });
});
