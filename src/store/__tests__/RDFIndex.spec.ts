import "../../__tests__/useFactory";

import rdf from "@ontologies/core";
import * as owl from "@ontologies/owl";
import * as rdfx from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";
import "jest";

import { RDFAdapter } from "../RDFAdapter";

describe("RDFAdapter", () => {
    describe("match", () => {
        const store = new RDFAdapter({ onChange: (): void => undefined });
        store.add(schema.Person, rdfx.type, schema.Thing);
        store.add(schema.Person, rdfx.type, rdfs.Resource);
        store.add(schema.Person, rdfs.label, rdf.literal("Person class"));

        store.add(schema.name, rdfx.type, rdfx.Property);
        store.add(schema.name, rdfs.label, rdf.literal("Object name"));
        const blank = rdf.blankNode();
        store.add(schema.name, owl.sameAs, blank);
        store.add(blank, schema.description, rdf.literal("The name of an object"));

        it ("queries through owl:sameAs", () => {
            expect(store.match(schema.name, schema.description, null))
                .toHaveLength(1);
        });
    });
});
