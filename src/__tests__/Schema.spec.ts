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
                expect(blankSchema().addHextuples([])).toHaveLength(0);
            });

            it("adds ontology statements", () => {
                const schema = blankSchema();
                const personIsAClass = rdfFactory.quad(schemaNS.Person, rdf.type, rdfs.Class);

                expect(schema.holdsQuad(personIsAClass)).toBeFalsy();

                schema.addHextuples([personIsAClass]);

                expect(schema.holdsQuad(personIsAClass)).toBeTruthy();
            });

            it("doesn't add generic statements", () => {
                const schema = blankSchema();
                const statement = resource1[1];

                schema.addHextuples([statement]);

                expect(schema.holdsQuad(statement)).toBeFalsy();
            });
        });

        describe("#mineForTypes", () => {
            it("returns the default ", () => {
                const s = blankSchema();
                expect(s.mineForTypes([]))
                    .toEqual([rdfs.Resource]);
            });

            it("ensures all have rdfs:Resource as base class", () => {
                const schema = blankSchema();
                const result = [
                    schemaNS.CreativeWork,
                    rdfs.Resource,
                ];

                expect(schema.mineForTypes([schemaNS.CreativeWork]))
                    .toEqual(result);
            });

            it("adds superclasses", () => {
                const schema = blankSchema();
                const result = [
                    schemaNS.BlogPosting,
                    schemaNS.CreativeWork,
                    schemaNS.Thing,
                    rdfs.Resource,
                ];

                schema.addHextuples([
                    rdfFactory.quad(schemaNS.CreativeWork, rdfs.subClassOf, schemaNS.Thing),
                    rdfFactory.quad(schemaNS.BlogPosting, rdfs.subClassOf, schemaNS.CreativeWork),
                ]);

                expect(schema.mineForTypes([schemaNS.BlogPosting]))
                    .toEqual(result);
            });
        });
    });

    describe("when filled", () => {
        const schema = blankSchema();
        schema.addHextuples([
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
                    NS.ex("D"),
                    NS.ex("A"),
                    NS.ex("C"),
                ])).toEqual([
                    NS.ex("D"), // 3
                    NS.ex("C"), // 2
                    NS.ex("A"), // 1
                ]);
            });

            it("accounts for supertype depth", () => {
                expect(schema.sort([
                    NS.ex("G"),
                    NS.ex("C"),
                    NS.ex("B"),
                    NS.ex("A"),
                    NS.ex("D"),
                ])).toEqual([
                    NS.ex("D"), // 3
                    NS.ex("C"), // 2
                    NS.ex("B"), // 2
                    NS.ex("G"), // 2
                    NS.ex("A"), // 1
                ]);
            });
        });
    });
});
