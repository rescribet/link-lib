import "../../__tests__/useHashFactory";

import rdf from "@ontologies/core";
import * as owl from "@ontologies/owl";
import * as rdfx from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";
import "jest";

import RDFIndex from "../RDFIndex";

describe("RDFIndex", () => {
    describe("any", () => {
        const store = new RDFIndex();
        store.add(schema.Person, rdfx.type, schema.Thing);
        store.add(schema.Person, rdfx.type, rdfs.Resource);
        store.add(schema.Person, schema.name, rdf.literal("Person class"));

        store.add(schema.AboutPage, schema.name, rdf.literal("About"));

        it("returns undefined without match", () => {
            expect(store.any(null, schema.Person, rdfs.Resource, rdf.defaultGraph())).toBeUndefined();
        });

        it("resolves subject", () => {
            expect(store.any(null, rdfx.type, rdfs.Resource, rdf.defaultGraph())).toEqual(schema.Person);
        });

        it("resolves predicate", () => {
            expect(store.any(schema.Person, null, rdfs.Resource, rdf.defaultGraph())).toEqual(rdfx.type);
        });

        it("resolves object", () => {
            expect(store.any(schema.Person, rdfx.type, null, rdf.defaultGraph())).toEqual(schema.Thing);
        });

        it("resolves graph", () => {
            expect(store.any(schema.Person, rdfx.type, rdfs.Resource, null)).toEqual(rdf.defaultGraph());
        });

        it("resolves nothing otherwise", () => {
            expect(store.any(schema.Person, rdfx.type, rdfs.Resource, rdf.defaultGraph())).toBeUndefined();
        });
    });

    describe("match", () => {
        const store = new RDFIndex();
        store.add(schema.Person, rdfx.type, schema.Thing);
        store.add(schema.Person, rdfx.type, rdfs.Resource);
        store.add(schema.Person, rdfs.label, rdf.literal("Person class"));

        store.add(schema.name, rdfx.type, rdfx.Property);
        store.add(schema.name, rdfs.label, rdf.literal("Object name"));
        const blank = rdf.blankNode();
        store.add(schema.name, owl.sameAs, blank);
        store.add(blank, schema.description, rdf.literal("The name of an object"));

        it ("queries through owl:sameAs", () => {
            expect(store.match(schema.name, null, null, null))
                .toHaveLength(4);
        });

        it ("holds through owl:sameAs", () => {
            expect(store.holds(
                schema.name,
                schema.description,
                rdf.literal("The name of an object"),
                rdf.defaultGraph(),
            )).toBeTruthy();
        });
    });
});
