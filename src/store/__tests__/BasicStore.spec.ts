import "../../__tests__/useHashFactory";

import rdf, { DataFactory } from "@ontologies/core";
import owl from "@ontologies/owl";
import * as rdfx from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";
import "jest";

import BasicStore from "../BasicStore";
describe("BasicStore", () => {
    describe("constructor", () => {
        describe("without arguments", () => {
            const store = new BasicStore();

            it("defaults dataCallbacks", () => expect(store.dataCallbacks).toEqual([]));
            it("defaults quads", () => expect(store.quads).toEqual([]));
            it("defaults rdfFactory", () => expect(store.rdfFactory).toEqual(rdf));
        });

        describe("with arguments", () => {
            const rdfFactory = {} as DataFactory;
            const quads = [rdf.quad()];
            const store = new BasicStore({ quads, rdfFactory });

            it("sets quads", () => expect(store.quads).toEqual(quads));
            it("sets rdfFactory", () => expect(store.rdfFactory).toEqual(rdfFactory));
        });
    });

    describe("match", () => {
        const store = new BasicStore();
        store.add(schema.Person, rdfx.type, schema.Thing);
        store.add(schema.Person, rdfx.type, rdfs.Resource);
        store.add(schema.Person, rdfs.label, rdf.literal("Person class"));

        store.add(schema.name, rdfx.type, rdfx.Property);
        store.add(schema.name, rdfs.label, rdf.literal("Object name"));
        const blank = rdf.blankNode();
        store.add(blank, schema.description, rdf.literal("The name of an object"));
        store.add(blank, owl.sameAs, schema.name);

        it("returns a all quads", () => {
            expect(store.match(schema.Person, rdfx.type, null, null))
                .toEqual([
                    rdf.quad(schema.Person, rdfx.type, schema.Thing),
                    rdf.quad(schema.Person, rdfx.type, rdfs.Resource),
                ]);
        });

        it("returns a single quad", () => {
            expect(store.match(schema.Person, rdfx.type, null, null, true))
                .toEqual([rdf.quad(schema.Person, rdfx.type, schema.Thing)]);
        });

        it("wildcards subject", () => {
            expect(store.match(null, rdfx.type, schema.Thing, rdf.defaultGraph()))
                .toEqual([rdf.quad(schema.Person, rdfx.type, schema.Thing)]);
        });

        it("wildcards predicate", () => {
            expect(store.match(schema.Person, null, schema.Thing, rdf.defaultGraph()))
                .toEqual([rdf.quad(schema.Person, rdfx.type, schema.Thing)]);
        });

        it("wildcards object", () => {
            expect(store.match(schema.Person, rdfx.type, null, rdf.defaultGraph()))
                .toEqual([
                    rdf.quad(schema.Person, rdfx.type, schema.Thing),
                    rdf.quad(schema.Person, rdfx.type, rdfs.Resource),
                ]);
        });

        it("wildcards graph", () => {
            expect(store.match(schema.Person, rdfx.type, schema.Thing, null))
                .toEqual([rdf.quad(schema.Person, rdfx.type, schema.Thing)]);
        });
    });

    describe("remove", () => {
        const store = new BasicStore();
        it("throws when no quads match", () => {
            expect(() => {
                store.remove(rdf.quad());
            }).toThrow();
        });
    });
});
