import rdfFactory, { createNS, NamedNode, Quadruple } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";

import { getBasicStore } from "../../testUtilities";
import { RecordState } from "../RecordState";
import { DataSlice, StructuredStore } from "../StructuredStore";

const example = createNS("http://example.com/");
const defaultGraph: NamedNode = rdfFactory.defaultGraph();

const schemaT = schema.Thing;
const thingStatements: Quadruple[] = [
    [schemaT, rdf.type, rdfs.Class, defaultGraph],
    [schemaT, rdfs.comment, rdfFactory.literal("The most generic type"), defaultGraph],
    [schemaT, rdfs.label, rdfFactory.literal("Thing."), defaultGraph],
];

describe("StructuredStore", () => {
    it("sets the journal on start", () => {
        const data: DataSlice = {
            "/resource/4": {
                _id: rdfFactory.namedNode("/resource/4"),
            },
        };
        const changeHandler = jest.fn();
        const test = new StructuredStore("rdf:defaultGraph", data, changeHandler);

        expect(test.journal.get("/resource/4").current).toEqual(RecordState.Present);
    });

    it("bumps the journal entry", async () => {
        const store = getBasicStore();
        store.store.addQuadruples([
            thingStatements[0],
        ]);
        store.store.flush();
        const before = store.store.getInternalStore().store.getStatus(schemaT.value).lastUpdate;

        await new Promise((resolve): void => { window.setTimeout(resolve, 100); });

        store.store.addQuadruples([
            thingStatements[1],
            thingStatements[2],
        ]);
        store.store.flush();
        expect(store.store.getInternalStore().store.getStatus(schemaT.value).lastUpdate)
            .toBeGreaterThan(before);
    });

    it("bumps the changeTimestamp", async () => {
        const store = getBasicStore();
        const resource = example("test");
        store.store.add(resource, rdf.type, schema.Person);
        store.store.flush();
        const before = store.store.getInternalStore().store.getStatus(resource.value).lastUpdate;

        await new Promise((resolve): void => { window.setTimeout(resolve, 100); });

        store.store.removeResource(resource);
        expect(store.store.getInternalStore().store.getStatus(resource.value).lastUpdate)
            .toBeGreaterThan(before);
    });

    describe("withAlias", () => {
        const data: DataSlice = {
            "/resource/4": {
                _id: rdfFactory.namedNode("/resource/4"),
            },
        };

        it("copies the journal entries", () => {
            const changeHandler = jest.fn();
            const test = new StructuredStore("rdf:defaultGraph", data, changeHandler);
            test.withAlias("/resource/4", "/resource/5");

            expect(test.journal.get("/resource/4").current).toEqual(RecordState.Present);
        });

        it("queries through aliases", () => {
            const changeHandler = jest.fn();
            const test = new StructuredStore("rdf:defaultGraph", data, changeHandler);
            const aliased = test.withAlias("/resource/4", "/resource/5");

            expect(aliased.getRecord("/resource/4")).toEqual(data["/resource/4"]);
            expect(aliased.journal.get("/resource/4").current).toEqual(RecordState.Present);

            expect(aliased.getRecord("/resource/5")).toEqual(data["/resource/4"]);
            expect(aliased.journal.get("/resource/5").current).toEqual(RecordState.Present);
        });
    });

    describe("deleteFieldMatching", () => {
        const recordId = "/resource/4";
        const createData = (): DataSlice => ({
            [recordId]: {
                _id: rdfFactory.namedNode("/resource/4"),
                count: rdfFactory.literal(2),
                name: [
                    rdfFactory.literal("name1"),
                    rdfFactory.literal("name2"),
                    rdfFactory.literal("name3"),
                ],
            },
        });

        it("preserves different value", () => {
            const store = new StructuredStore("rdf:defaultGraph", createData());

            expect(store.getField(recordId, "count")).toEqual(rdfFactory.literal(2));
            store.deleteFieldMatching(recordId, "count", rdfFactory.literal(1));
            expect(store.getField(recordId, "count")).toEqual(rdfFactory.literal(2));
        });

        it("deletes matching value", () => {
            const store = new StructuredStore("rdf:defaultGraph", createData());

            expect(store.getField(recordId, "count")).toEqual(rdfFactory.literal(2));
            store.deleteFieldMatching(recordId, "count", rdfFactory.literal(2));
            expect(store.getField(recordId, "count")).toBeUndefined();
        });

        it("preserves different multimap value", () => {
            const store = new StructuredStore("rdf:defaultGraph", createData());

            expect(store.getField(recordId, "name")).toContainEqual(rdfFactory.literal("name2"));
            store.deleteFieldMatching(recordId, "name", rdfFactory.literal("name3"));
            expect(store.getField(recordId, "name")).toContainEqual(rdfFactory.literal("name2"));
        });

        it("deletes matching multimap value", () => {
            const store = new StructuredStore("rdf:defaultGraph", createData());

            expect(store.getField(recordId, "name")).toContainEqual(rdfFactory.literal("name2"));
            store.deleteFieldMatching(recordId, "name", rdfFactory.literal("name2"));
            expect(store.getField(recordId, "name")).not.toContainEqual(rdfFactory.literal("name2"));
        });
    });
});
