import "../__tests__/useHashFactory";

import rdfFactory from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import schemaNS from "@ontologies/schema";
import "jest";

import ex from "../ontology/ex";
import example from "../ontology/example";
import { RDFStore } from "../RDFStore";
import { Schema } from "../Schema";

const resource1 = [
    rdfFactory.quad(example.ns("5"), rdf.type, schemaNS.CreativeWork),
    rdfFactory.quad(example.ns("5"), schemaNS.name, rdfFactory.literal("The name")),
    rdfFactory.quad(example.ns("5"), schemaNS.text, rdfFactory.literal("Body text")),
];

const blankSchema = (): Schema => new Schema(new RDFStore());

describe("Schema", () => {
    describe("when empty", () => {
        describe("initializes with the correct statements", () => {
            const schema = blankSchema();

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
                const expected = rdfFactory.quad(
                    rdf.predicate,
                    rdfs.range,
                    rdfs.Resource,
                );

                expect(schema.holdsQuad(expected))
                    .toBeTruthy();
            });
        });

        describe("#addStatements", () => {
            it("adds an empty array", () => {
                expect(blankSchema().addQuads([])).toHaveLength(0);
            });

            it("adds ontology statements", () => {
                const schema = blankSchema();
                const personIsAClass = rdfFactory.quad(schemaNS.Person, rdf.type, rdfs.Class);

                expect(schema.holdsQuad(personIsAClass)).toBeFalsy();

                schema.addQuads([personIsAClass]);

                expect(schema.holdsQuad(personIsAClass)).toBeTruthy();
            });

            it("doesn't add generic statements", () => {
                const schema = blankSchema();
                const statement = resource1[1];

                schema.addQuads([statement]);

                expect(schema.holdsQuad(statement)).toBeFalsy();
            });
        });

        describe("#mineForTypes", () => {
            it("returns the default ", () => {
                const s = blankSchema();
                expect(s.mineForTypes([]))
                    .toEqual([rdfFactory.id(rdfs.Resource)]);
            });

            it("ensures all have rdfs:Resource as base class", () => {
                const schema = blankSchema();
                const result = [
                    rdfFactory.id(schemaNS.CreativeWork),
                    rdfFactory.id(rdfs.Resource),
                ];

                expect(schema.mineForTypes([rdfFactory.id(schemaNS.CreativeWork)]))
                    .toEqual(result);
            });

            it("adds superclasses", () => {
                const schema = blankSchema();
                const result = [
                    rdfFactory.id(schemaNS.BlogPosting),
                    rdfFactory.id(schemaNS.CreativeWork),
                    rdfFactory.id(schemaNS.Thing),
                    rdfFactory.id(rdfs.Resource),
                ];

                schema.addQuads([
                    rdfFactory.quad(schemaNS.CreativeWork, rdfs.subClassOf, schemaNS.Thing),
                    rdfFactory.quad(schemaNS.BlogPosting, rdfs.subClassOf, schemaNS.CreativeWork),
                ]);

                expect(schema.mineForTypes([rdfFactory.id(schemaNS.BlogPosting)]))
                    .toEqual(result);
            });
        });
    });

    describe("when filled", () => {
        const schema = blankSchema();
        schema.addQuads([
            rdfFactory.quad(ex.ns("A"), rdfs.subClassOf, rdfs.Class),

            rdfFactory.quad(ex.ns("B"), rdfs.subClassOf, ex.ns("A")),

            rdfFactory.quad(ex.ns("C"), rdfs.subClassOf, ex.ns("A")),

            rdfFactory.quad(ex.ns("D"), rdfs.subClassOf, ex.ns("C")),

            rdfFactory.quad(ex.ns("E"), rdfs.subClassOf, rdfs.Class),

            rdfFactory.quad(ex.ns("F"), rdfs.subClassOf, rdfs.Class),

            rdfFactory.quad(ex.ns("G"), rdfs.subClassOf, example.ns("E")), // TODO: check if typo
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
