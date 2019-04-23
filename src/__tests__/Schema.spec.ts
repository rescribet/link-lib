import "jest";
import {
    Literal,
    Statement,
} from "rdflib";

import { RDFStore } from "../RDFStore";
import { Schema } from "../Schema";
import { defaultNS as NS } from "../utilities/constants";

const resource1 = [
    new Statement(NS.example("5"), NS.rdf("type"), NS.schema("CreativeWork")),
    new Statement(NS.example("5"), NS.schema("name"), new Literal("The name")),
    new Statement(NS.example("5"), NS.schema("text"), new Literal("Body text")),
];

const blankSchema = (): Schema => new Schema(new RDFStore());

describe("Schema", () => {
    describe("when empty", () => {
        describe("initializes with the correct statements", () => {
            const schema = blankSchema();

            it("processes the axioms", () => {
                // TODO: verify
                expect(schema.statements.length)
                    .toEqual(42);
            });

            // TODO: Implement core rdf logic
            // it("holds rdfs:Class to be an instance of rdfs:Class", () => {
            //     expect(schema.isInstanceOf(NS.rdfs("Class"), NS.rdfs("Class")))
            //         .toBeTruthy();
            // });
            //
            // it("has rdfs:Resource as rdfs:Class", () => {
            //     expect(schema.mineForTypes([NS.rdfs("Resource")]))
            //         .toEqual([
            //             NS.rdfs("Resource"),
            //             NS.rdfs("Class"),
            //         ]);
            // });

            it("has holds rdf:predicate, RDFSrange, RDFSResource", () => {
                const expected = new Statement(
                    NS.rdf("predicate"),
                    NS.rdfs("range"),
                    NS.rdfs("Resource"),
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
                const personIsAClass = new Statement(NS.schema("Person"), NS.rdf("type"), NS.rdfs("Class"));

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
                    .toEqual([NS.rdfs("Resource").sI]);
            });

            it("ensures all have rdfs:Resource as base class", () => {
                const schema = blankSchema();
                const result = [
                    NS.schema("CreativeWork").sI,
                    NS.rdfs("Resource").sI,
                ];

                expect(schema.mineForTypes([NS.schema("CreativeWork").sI]))
                    .toEqual(result);
            });

            it("adds superclasses", () => {
                const schema = blankSchema();
                const result = [
                    NS.schema("BlogPost").sI,
                    NS.schema("CreativeWork").sI,
                    NS.schema("Thing").sI,
                    NS.rdfs("Resource").sI,
                ];

                schema.addStatements([
                    new Statement(NS.schema("CreativeWork"), NS.rdfs("subClassOf"), NS.schema("Thing")),
                    new Statement(NS.schema("BlogPost"), NS.rdfs("subClassOf"), NS.schema("CreativeWork")),
                ]);

                expect(schema.mineForTypes([NS.schema("BlogPost").sI]))
                    .toEqual(result);
            });
        });
    });

    describe("when filled", () => {
        const schema = blankSchema();
        schema.addStatements([
            new Statement(NS.ex("A"), NS.rdfs("subClassOf"), NS.rdf("class")),

            new Statement(NS.ex("B"), NS.rdfs("subClassOf"), NS.ex("A")),

            new Statement(NS.ex("C"), NS.rdfs("subClassOf"), NS.ex("A")),

            new Statement(NS.ex("D"), NS.rdfs("subClassOf"), NS.ex("C")),

            new Statement(NS.ex("E"), NS.rdfs("subClassOf"), NS.rdf("class")),

            new Statement(NS.ex("F"), NS.rdfs("subClassOf"), NS.rdf("class")),

            new Statement(NS.ex("G"), NS.rdfs("subClassOf"), NS.rdf("E")),
        ]);

        describe("#sort", () => {
            it("accounts for class inheritance", () => {
                expect(schema.sort([
                    NS.ex("D").sI,
                    NS.ex("A").sI,
                    NS.ex("C").sI,
                ])).toEqual([
                    NS.ex("D").sI, // 3
                    NS.ex("C").sI, // 2
                    NS.ex("A").sI, // 1
                ]);
            });

            it("accounts for supertype depth", () => {
                expect(schema.sort([
                    NS.ex("G").sI,
                    NS.ex("C").sI,
                    NS.ex("B").sI,
                    NS.ex("A").sI,
                    NS.ex("D").sI,
                ])).toEqual([
                    NS.ex("D").sI, // 3
                    NS.ex("C").sI, // 2
                    NS.ex("B").sI, // 2
                    NS.ex("G").sI, // 2
                    NS.ex("A").sI, // 1
                ]);
            });
        });
    });
});
