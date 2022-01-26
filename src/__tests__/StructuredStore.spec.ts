import rdfFactory, { createNS, NamedNode, Quadruple } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";

import { getBasicStore } from "../testUtilities";

const example = createNS("http://example.com/");
const defaultGraph: NamedNode = rdfFactory.defaultGraph();

const schemaT = schema.Thing;
const thingStatements: Quadruple[] = [
    [schemaT, rdf.type, rdfs.Class, defaultGraph],
    [schemaT, rdfs.comment, rdfFactory.literal("The most generic type"), defaultGraph],
    [schemaT, rdfs.label, rdfFactory.literal("Thing."), defaultGraph],
];

describe("StructuredStore", () => {
    it("bumps the journal entry", async () => {
        const store = getBasicStore();
        store.store.addQuadruples([
            thingStatements[0],
        ]);
        store.store.flush();
        const before = store.store.getInternalStore().store.journal.get(schemaT.value).lastUpdate;

        await new Promise((resolve): void => { window.setTimeout(resolve, 100); });

        store.store.addQuadruples([
            thingStatements[1],
            thingStatements[2],
        ]);
        store.store.flush();
        expect(store.store.getInternalStore().store.journal.get(schemaT.value).lastUpdate).toBeGreaterThan(before);
    });

    it("bumps the changeTimestamp", async () => {
        const store = getBasicStore();
        const resource = example("test");
        store.store.add(resource, rdf.type, schema.Person);
        store.store.flush();
        const before = store.store.getInternalStore().store.journal.get(resource.value).lastUpdate;

        await new Promise((resolve): void => { window.setTimeout(resolve, 100); });

        store.store.removeResource(resource);
        expect(store.store.getInternalStore().store.journal.get(resource.value).lastUpdate).toBeGreaterThan(before);
    });
});
