import "../__tests__/useHashFactory";

import rdfFactory, { NamedNode, QuadPosition, Quadruple } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schemaNS from "@ontologies/schema";
import "jest";

import ex from "../ontology/ex";
import example from "../ontology/example";
import { RDFStore } from "../RDFStore";
import { Schema } from "../Schema";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();
const resource1: Quadruple[] = [
    [example.ns("5"), rdf.type, schemaNS.CreativeWork, defaultGraph],
    [example.ns("5"), schemaNS.name, rdfFactory.literal("The name"), defaultGraph],
    [example.ns("5"), schemaNS.text, rdfFactory.literal("Body text"), defaultGraph],
];

const blankSchema = (): [RDFStore, Schema] => {
    const store = new RDFStore();
    const schema = new Schema(store);
    return [store, schema];
};

describe("Schema", () => {
    describe("when empty", () => {
        describe("initializes with the correct statements", () => {
            const [_, schema] = blankSchema();

            // TODO: Implement core rdf logic
            // it("holds rdfs:Class to be an instance of rdfs:Class", () => {
            //     expect(schema.isInstanceOf(rdfs.Class, rdfs.Class))
            //         .toBeTruthy();
            // });
            //
            // it("has rdfs:Resource as rdfs:Class", () => {
            //     expect(schema.mineForTypes([rdfs.Resource]))
            //         .toEqual([
            //             rdfs.Resource,
            //             rdfs.Class,
            //         ]);
            // });

            it("has holds rdf:predicate, RDFSrange, RDFSResource", () => {
                const expected: Quadruple = [
                    rdf.predicate,
                    rdfs.range,
                    rdfs.Resource,
                    defaultGraph,
                ];

                expect(schema.holds(
                    expected[QuadPosition.subject],
                    expected[QuadPosition.predicate],
                    expected[QuadPosition.object],
                )).toBeTruthy();
            });
        });

        describe("#addStatements", () => {
            it("adds an empty array", () => {
                expect(blankSchema()[0].addQuadruples([])).toHaveLength(0);
            });

            it("adds ontology statements", () => {
                const [store, schema] = blankSchema();
                const personIsAClass: Quadruple = [schemaNS.Person, rdf.type, rdfs.Class, defaultGraph];

                expect(schema.holds(
                    personIsAClass[QuadPosition.subject],
                    personIsAClass[QuadPosition.predicate],
                    personIsAClass[QuadPosition.object],
                )).toBeFalsy();

                store.addQuadruples([personIsAClass]);

                expect(schema.holds(
                    personIsAClass[QuadPosition.subject],
                    personIsAClass[QuadPosition.predicate],
                    personIsAClass[QuadPosition.object],
                )).toBeTruthy();
            });

            it("doesn't add generic statements", () => {
                const [store, schema] = blankSchema();
                const s = resource1[1];

                store.addQuadruples([s]);

                expect(schema.holds(
                    s[QuadPosition.subject],
                    s[QuadPosition.predicate],
                    s[QuadPosition.object],
                )).toBeFalsy();
            });
        });

        describe("#mineForTypes", () => {
            it("returns the default ", () => {
                const [, s] = blankSchema();
                expect(s.mineForTypes([]))
                    .toEqual([rdfFactory.id(rdfs.Resource)]);
            });

            it("ensures all have rdfs:Resource as base class", () => {
                const [_, schema] = blankSchema();
                const result = [
                    rdfFactory.id(schemaNS.CreativeWork),
                    rdfFactory.id(rdfs.Resource),
                ];

                expect(schema.mineForTypes([rdfFactory.id(schemaNS.CreativeWork)]))
                    .toEqual(result);
            });

            it("adds superclasses", () => {
                const [store, schema] = blankSchema();
                const result = [
                    rdfFactory.id(schemaNS.BlogPosting),
                    rdfFactory.id(schemaNS.CreativeWork),
                    rdfFactory.id(schemaNS.Thing),
                    rdfFactory.id(rdfs.Resource),
                ];

                store.addQuadruples([
                    [schemaNS.CreativeWork, rdfs.subClassOf, schemaNS.Thing, defaultGraph],
                    [schemaNS.BlogPosting, rdfs.subClassOf, schemaNS.CreativeWork, defaultGraph],
                ]);

                expect(schema.mineForTypes([rdfFactory.id(schemaNS.BlogPosting)]))
                    .toEqual(result);
            });
        });
    });

    describe("when filled", () => {
        const [store, schema] = blankSchema();
        store.addQuadruples([
            [ex.ns("A"), rdfs.subClassOf, rdfs.Class, defaultGraph],

            [ex.ns("B"), rdfs.subClassOf, ex.ns("A"), defaultGraph],

            [ex.ns("C"), rdfs.subClassOf, ex.ns("A"), defaultGraph],

            [ex.ns("D"), rdfs.subClassOf, ex.ns("C"), defaultGraph],

            [ex.ns("E"), rdfs.subClassOf, rdfs.Class, defaultGraph],

            [ex.ns("F"), rdfs.subClassOf, rdfs.Class, defaultGraph],

            [ex.ns("G"), rdfs.subClassOf, example.ns("E"), defaultGraph], // TODO: check if typo
        ]);

        describe("#sort", () => {
            it("accounts for class inheritance", () => {
                expect(schema.sort([
                    rdfFactory.id(ex.ns("D")),
                    rdfFactory.id(ex.ns("A")),
                    rdfFactory.id(ex.ns("C")),
                ])).toEqual([
                    rdfFactory.id(ex.ns("D")), // 3
                    rdfFactory.id(ex.ns("C")), // 2
                    rdfFactory.id(ex.ns("A")), // 1
                ]);
            });

            it("accounts for supertype depth", () => {
                expect(schema.sort([
                    rdfFactory.id(ex.ns("G")),
                    rdfFactory.id(ex.ns("C")),
                    rdfFactory.id(ex.ns("B")),
                    rdfFactory.id(ex.ns("A")),
                    rdfFactory.id(ex.ns("D")),
                ])).toEqual([
                    rdfFactory.id(ex.ns("D")), // 3
                    rdfFactory.id(ex.ns("C")), // 2
                    rdfFactory.id(ex.ns("B")), // 2
                    rdfFactory.id(ex.ns("G")), // 2
                    rdfFactory.id(ex.ns("A")), // 1
                ]);
            });
        });
    });
});
