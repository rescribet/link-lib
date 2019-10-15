import "../__tests__/useHashFactory";

import rdfFactory from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import schemaNS from "@ontologies/schema";
import "jest";

import { RDFStore } from "../RDFStore";
import { Schema } from "../Schema";
import { defaultNS as NS } from "../utilities/constants";

const resource1 = [
    rdfFactory.quad(NS.example("5"), rdf.type, schemaNS.CreativeWork),
    rdfFactory.quad(NS.example("5"), schemaNS.name, rdfFactory.literal("The name")),
    rdfFactory.quad(NS.example("5"), schemaNS.text, rdfFactory.literal("Body text")),
];

const blankSchema = (): Schema => new Schema(new RDFStore());

describe("Schema", () => {
    describe("when empty", () => {
        describe("initializes with the correct statements", () => {
            const schema = blankSchema();

            it("processes the axioms", () => {
                // TODO: verify
                expect(schema.statements.length)
                    .toEqual(67);
            });

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

                expect(schema.holdsStatement(expected))
                    .toBeTruthy();
            });
        });

        describe("#addStatements", () => {
            it("adds an empty array", () => {
                expect(blankSchema().addStatements([])).toBeUndefined();
            });

            it("adds ontology statements", () => {
                const schema = blankSchema();
                const personIsAClass = rdfFactory.quad(schemaNS.Person, rdf.type, rdfs.Class);

                expect(schema.holdsStatement(personIsAClass)).toBeFalsy();

                schema.addStatements([personIsAClass]);

                expect(schema.holdsStatement(personIsAClass)).toBeTruthy();
            });

            it("doesn't add generic statements", () => {
                const schema = blankSchema();
                const statement = resource1[1];

                schema.addStatements([statement]);

                expect(schema.holdsStatement(statement)).toBeFalsy();
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

                schema.addStatements([
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
        schema.addStatements([
            rdfFactory.quad(NS.ex("A"), rdfs.subClassOf, rdfs.Class),

            rdfFactory.quad(NS.ex("B"), rdfs.subClassOf, NS.ex("A")),

            rdfFactory.quad(NS.ex("C"), rdfs.subClassOf, NS.ex("A")),

            rdfFactory.quad(NS.ex("D"), rdfs.subClassOf, NS.ex("C")),

            rdfFactory.quad(NS.ex("E"), rdfs.subClassOf, rdfs.Class),

            rdfFactory.quad(NS.ex("F"), rdfs.subClassOf, rdfs.Class),

            rdfFactory.quad(NS.ex("G"), rdfs.subClassOf, NS.example("E")), // TODO: check if typo
        ]);

        describe("#sort", () => {
            it("accounts for class inheritance", () => {
                expect(schema.sort([
                    rdfFactory.id(NS.ex("D")),
                    rdfFactory.id(NS.ex("A")),
                    rdfFactory.id(NS.ex("C")),
                ])).toEqual([
                    rdfFactory.id(NS.ex("D")), // 3
                    rdfFactory.id(NS.ex("C")), // 2
                    rdfFactory.id(NS.ex("A")), // 1
                ]);
            });

            it("accounts for supertype depth", () => {
                expect(schema.sort([
                    rdfFactory.id(NS.ex("G")),
                    rdfFactory.id(NS.ex("C")),
                    rdfFactory.id(NS.ex("B")),
                    rdfFactory.id(NS.ex("A")),
                    rdfFactory.id(NS.ex("D")),
                ])).toEqual([
                    rdfFactory.id(NS.ex("D")), // 3
                    rdfFactory.id(NS.ex("C")), // 2
                    rdfFactory.id(NS.ex("B")), // 2
                    rdfFactory.id(NS.ex("G")), // 2
                    rdfFactory.id(NS.ex("A")), // 1
                ]);
            });
        });
    });
});
