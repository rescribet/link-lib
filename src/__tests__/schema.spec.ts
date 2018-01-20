import "jest";
import {
    Literal,
    Statement,
} from "rdflib";

import { RDFStore } from "../RDFStore";
import { Schema } from "../Schema";
import { defaultNS as NS } from "../utilities";

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
                    .toEqual(33);
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
                    .toEqual([NS.rdfs("Resource")]);
            });

            it("returns self when empty", () => {
                const schema = blankSchema();
                const result = [
                    NS.schema("CreativeWork"),
                    NS.rdfs("Resource"),
                ];

                expect(schema.mineForTypes([NS.schema("CreativeWork")]))
                    .toEqual(result);
            });

            // it("returns self when nothing matches", () => {
            //
            // });
        });
    });
});
