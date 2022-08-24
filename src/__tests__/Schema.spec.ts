import "./useFactory";

import rdfFactory, { NamedNode } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schemaNS from "@ontologies/schema";
import "jest";

import ex from "../ontology/ex";
import example from "../ontology/example";
import { RDFStore } from "../RDFStore";
import { Schema } from "../Schema";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();
// const resource1: Quadruple[] = [
//     [example.ns("5"), rdf.type, schemaNS.CreativeWork, defaultGraph],
//     [example.ns("5"), schemaNS.name, rdfFactory.literal("The name"), defaultGraph],
//     [example.ns("5"), schemaNS.text, rdfFactory.literal("Body text"), defaultGraph],
// ];

const blankSchema = (): [RDFStore, Schema] => {
    const store = new RDFStore();
    const schema = new Schema(store);
    return [store, schema];
};

describe("Schema", () => {
    it("reads seed data from the store", () => {
        const dataStore = new RDFStore({
            data: {
                [schemaNS.Thing.value]: {
                    _id: schemaNS.Thing,
                    [rdf.type.value]: rdfs.Class,
                },
                [schemaNS.CreativeWork.value]: {
                    _id: schemaNS.CreativeWork,
                    [rdfs.subClassOf.value]: schemaNS.Thing,
                },
                [schemaNS.BlogPosting.value]: {
                    _id: schemaNS.BlogPosting,
                    [rdfs.subClassOf.value]: schemaNS.CreativeWork,
                },
                [schemaNS.Person.value]: {
                    _id: schemaNS.Person,
                    [rdfs.subClassOf.value]: schemaNS.Thing,
                },
            },
        });

        const schema = new Schema(dataStore);

        expect(schema.expand([schemaNS.Thing.value])).toEqual([
            schemaNS.Thing.value,
            rdfs.Resource.value,
        ]);
        expect(schema.expand([schemaNS.BlogPosting.value])).toEqual([
            schemaNS.BlogPosting.value,
            schemaNS.CreativeWork.value,
            schemaNS.Thing.value,
            rdfs.Resource.value,
        ]);
        expect(schema.expand([schemaNS.Person.value])).toEqual([
            schemaNS.Person.value,
            schemaNS.Thing.value,
            rdfs.Resource.value,
        ]);
        expect(schema.expand([schemaNS.BlogPosting.value, schemaNS.Person.value])).toEqual([
            schemaNS.BlogPosting.value,
            schemaNS.Person.value,
            schemaNS.CreativeWork.value,
            schemaNS.Thing.value,
            rdfs.Resource.value,
        ]);
    });

    describe("when empty", () => {
        describe("#mineForTypes", () => {
            it("returns the default ", () => {
                const [, s] = blankSchema();
                expect(s.mineForTypes([]))
                    .toEqual([rdfs.Resource.value]);
            });

            it("ensures all have rdfs:Resource as base class", () => {
                const [_, schema] = blankSchema();
                const result = [
                    schemaNS.CreativeWork.value,
                    rdfs.Resource.value,
                ];

                expect(schema.mineForTypes([schemaNS.CreativeWork.value]))
                    .toEqual(result);
            });

            it("adds superclasses", () => {
                const [store, schema] = blankSchema();
                const result = [
                    schemaNS.BlogPosting.value,
                    schemaNS.CreativeWork.value,
                    schemaNS.Thing.value,
                    rdfs.Resource.value,
                ];

                store.addQuads([
                    [schemaNS.CreativeWork, rdfs.subClassOf, schemaNS.Thing, defaultGraph],
                    [schemaNS.BlogPosting, rdfs.subClassOf, schemaNS.CreativeWork, defaultGraph],
                ]);

                expect(schema.mineForTypes([
                    schemaNS.BlogPosting.value,
                ])).toEqual(result);
            });
        });
    });

    describe("when filled", () => {
        const [store, schema] = blankSchema();
        store.addQuads([
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
                    ex.ns("D").value,
                    ex.ns("A").value,
                    ex.ns("C").value,
                ])).toEqual([
                    ex.ns("D").value, // 3
                    ex.ns("C").value, // 2
                    ex.ns("A").value, // 1
                ]);
            });

            it("accounts for supertype depth", () => {
                expect(schema.sort([
                    ex.ns("G").value,
                    ex.ns("C").value,
                    ex.ns("B").value,
                    ex.ns("A").value,
                    ex.ns("D").value,
                ])).toEqual([
                    ex.ns("D").value, // 3
                    ex.ns("C").value, // 2
                    ex.ns("B").value, // 2
                    ex.ns("G").value, // 2
                    ex.ns("A").value, // 1
                ]);
            });
        });
    });
});
