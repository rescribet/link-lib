import "../../__tests__/useHashFactory";

import rdfFactory from "@ontologies/core";
import rdfx from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import schema from "@ontologies/schema";
import "jest";

import RDFIndex from "../RDFIndex";

describe("RDFIndex", () => {
    describe("any", () => {
        const store = new RDFIndex();
        store.add(schema.Person, rdfx.type, schema.Thing);
        store.add(schema.Person, rdfx.type, rdfs.Resource);
        store.add(schema.Person, schema.name, rdfFactory.literal("Person class"));

        store.add(schema.AboutPage, schema.name, rdfFactory.literal("About"));

        it("returns undefined without match", () => {
            expect(store.any(null, schema.Person, rdfs.Resource, rdfFactory.defaultGraph())).toBeUndefined();
        });

        it("resolves subject", () => {
            expect(store.any(null, rdfx.type, rdfs.Resource, rdfFactory.defaultGraph())).toEqual(schema.Person);
        });

        it("resolves predicate", () => {
            expect(store.any(schema.Person, null, rdfs.Resource, rdfFactory.defaultGraph())).toEqual(rdfx.type);
        });

        it("resolves object", () => {
            expect(store.any(schema.Person, rdfx.type, null, rdfFactory.defaultGraph())).toEqual(schema.Thing);
        });

        it("resolves graph", () => {
            expect(store.any(schema.Person, rdfx.type, rdfs.Resource, null)).toEqual(rdfFactory.defaultGraph());
        });

        it("resolves nothing otherwise", () => {
            expect(store.any(schema.Person, rdfx.type, rdfs.Resource, rdfFactory.defaultGraph())).toBeUndefined();
        });
    });
});
