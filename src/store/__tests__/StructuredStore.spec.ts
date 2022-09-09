import rdfFactory, { createNS, NamedNode, Quadruple } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";
import "../../__tests__/useFactory";

import { getBasicStore } from "../../testUtilities";
import { RecordState } from "../RecordState";
import { StructuredStore } from "../StructuredStore";
import { DataSlice } from "../types";

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
            "_:b1": {
                _id: rdfFactory.blankNode("_:b1"),
            },
        };
        const changeHandler = jest.fn();
        const test = new StructuredStore(defaultGraph.value, data, changeHandler);

        expect(test.journal.get("/resource/4").current).toEqual(RecordState.Present);
        expect(test.journal.get("_:b1").current).toEqual(RecordState.Present);

        expect(test.journal.get("/resource/5").current).toEqual(RecordState.Absent);
        expect(test.journal.get("_:b2").current).toEqual(RecordState.Absent);
    });

    it("bumps the journal entry", async () => {
        const store = getBasicStore();
        store.store.addQuads([
            thingStatements[0],
        ]);
        store.store.flush();
        const before = store.store.getInternalStore().store.getStatus(schemaT.value).lastUpdate;

        await new Promise((resolve): void => { window.setTimeout(resolve, 100); });

        store.store.addQuads([
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

    describe("setAlias", () => {
        const data: DataSlice = {
            "/resource/4": {
                _id: rdfFactory.namedNode("/resource/4"),
            },
        };

        it("copies the journal entries", () => {
            const changeHandler = jest.fn();
            const test = new StructuredStore(defaultGraph.value, data, changeHandler);
            test.setAlias("/resource/5", "/resource/4");

            expect(test.getStatus("/resource/5").current).toEqual(RecordState.Present);
            expect(test.getStatus("/resource/4").current).toEqual(RecordState.Present);
        });

        it("queries through aliases", () => {
            const changeHandler = jest.fn();
            const test = new StructuredStore(defaultGraph.value, data, changeHandler);
            test.setAlias("/resource/5", "/resource/4");

            expect(data["/resource/5"]).not.toEqual(data["/resource/4"]);

            expect(test.getRecord("/resource/4")).toEqual(data["/resource/4"]);
            expect(test.getStatus("/resource/4").current).toEqual(RecordState.Present);

            expect(test.getRecord("/resource/5")).toEqual(data["/resource/4"]);
            expect(test.getStatus("/resource/5").current).toEqual(RecordState.Present);
        });

        it("queries through multiple aliases", () => {
            const changeHandler = jest.fn();
            const name = rdfFactory.literal("Dee");
            const id = "/resource/4";

            const store = new StructuredStore(defaultGraph.value, data, changeHandler);

            expect(store.getField(id, "name")).toBeUndefined();
            expect(store.getField("/resource/5", "name")).toBeUndefined();
            expect(store.getField("/resource/6", "name")).toBeUndefined();

            store.setField(id, "name", name);

            expect(store.getField(id, "name")).toEqual(name);
            expect(store.getField("/resource/5", "name")).toBeUndefined();
            expect(store.getField("/resource/6", "name")).toBeUndefined();

            store.setAlias("/resource/5", id);

            expect(store.getField(id, "name")).toEqual(name);
            expect(store.getField("/resource/5", "name")).toEqual(name);
            expect(store.getField("/resource/6", "name")).toBeUndefined();

            store.setAlias("/resource/6", "/resource/5");

            expect(store.getField(id, "name")).toEqual(name);
            expect(store.getField("/resource/5", "name")).toEqual(name);
            expect(store.getField("/resource/6", "name")).toEqual(name);

            store.setAlias("/resource/5", "/resource/7");

            expect(store.getField(id, "name")).toEqual(name);
            expect(store.getField("/resource/5", "name")).toBeUndefined();
            // TODO
            // expect(store.getField("/resource/6", "name")).toBeUndefined();
        });
    });

    describe("addField", () => {
        const recordId = "/resource/addField";

        it("adds to nonexistent record", () => {
            const store = new StructuredStore();

            expect(store.getField(recordId, "name")).toBeUndefined();
            store.addField(recordId, "name", rdfFactory.literal("Dee"));
            expect(store.getField(recordId, "name")).toEqual(rdfFactory.literal("Dee"));
        });

        it("adds to existent record without existing field", () => {
            const store = new StructuredStore(defaultGraph.value, {
                [recordId]: {
                    _id: rdfFactory.namedNode(recordId),
                    count: rdfFactory.literal(0),
                },
            });

            expect(store.getField(recordId, "name")).toBeUndefined();
            store.addField(recordId, "name", rdfFactory.literal("Dee"));
            expect(store.getField(recordId, "name")).toEqual(rdfFactory.literal("Dee"));
        });

        it("adds to existent record with existing field", () => {
            const store = new StructuredStore(defaultGraph.value, {
                [recordId]: {
                    _id: rdfFactory.namedNode(recordId),
                    name: rdfFactory.literal("Andy"),
                },
            });

            expect(store.getField(recordId, "name")).toEqual(rdfFactory.literal("Andy"));
            store.addField(recordId, "name", rdfFactory.literal("Dee"));
            expect(store.getField(recordId, "name")).toEqual([
                rdfFactory.literal("Andy"),
                rdfFactory.literal("Dee"),
            ]);
        });
    });

    describe("setField", () => {
        const recordId = "/resource/addField";

        it("normalises single element list values", () => {
            const store = new StructuredStore();

            expect(store.getField(recordId, "name")).toBeUndefined();
            store.setField(recordId, "name", [rdfFactory.literal("Dee")]);
            expect(store.getField(recordId, "name")).toEqual(rdfFactory.literal("Dee"));
        });

        it("updates the journal", () => {
            const store = new StructuredStore();

            expect(store.getField(recordId, "name")).toBeUndefined();
            expect(store.journal.get(recordId)).toEqual({
                current: RecordState.Absent,
                lastUpdate: -1,
                previous: RecordState.Absent,
            });

            store.setField(recordId, "name", [rdfFactory.literal("Dee")]);

            expect(store.journal.get(recordId).current).toEqual(RecordState.Present);
            expect(store.journal.get(recordId).previous).toEqual(RecordState.Receiving);
            expect(store.journal.get(recordId).lastUpdate).not.toEqual(-1);

            expect(store.journal.get("_:b3")).toEqual({
                current: RecordState.Absent,
                lastUpdate: -1,
                previous: RecordState.Absent,
            });

            store.setField("_:b3", "name", [rdfFactory.literal("Dee")]);

            expect(store.journal.get("_:b3").current).toEqual(RecordState.Present);
            expect(store.journal.get("_:b3").previous).toEqual(RecordState.Receiving);
            expect(store.journal.get("_:b3").lastUpdate).not.toEqual(-1);
        });
    });

    describe("getField", () => {
        const data: DataSlice = {
            "/resource/4": {
                _id: rdfFactory.namedNode("/resource/4"),
                [rdf.ns("_2").value]: rdfFactory.literal("2"),
                [rdf.ns("_10").value]: rdfFactory.literal("10"),
                [rdf.ns("_0").value]: rdfFactory.literal("0"),
                [rdf.ns("_11").value]: rdfFactory.literal("11"),
                [rdf.ns("_1").value]: rdfFactory.literal("1"),
            },
        };

        it("preserves natural ordering for sequences", () => {
            const store = new StructuredStore(defaultGraph.value, data);

            expect(store.getField("/resource/4", rdfs.member.value))
                .toEqual([
                    rdfFactory.literal("0"),
                    rdfFactory.literal("1"),
                    rdfFactory.literal("2"),
                    rdfFactory.literal("10"),
                    rdfFactory.literal("11"),
                ]);
        });

        it("handles invalid sequence numbers", () => {
            const store = new StructuredStore(defaultGraph.value, {
                "/resource/4": {
                    _id: rdfFactory.namedNode("/resource/4"),
                    [rdf.ns("_2").value]: rdfFactory.literal("2"),
                    [rdf.ns("_10").value]: rdfFactory.literal("10"),
                    [rdf.ns("_afvz").value]: rdfFactory.literal("wrong"),
                    [rdf.ns("_11").value]: rdfFactory.literal("11"),
                    [rdf.ns("_1").value]: rdfFactory.literal("1"),
                },
            });

            expect(store.getField("/resource/4", rdfs.member.value))
                .toEqual([
                    rdfFactory.literal("1"),
                    rdfFactory.literal("2"),
                    rdfFactory.literal("10"),
                    rdfFactory.literal("11"),
                    rdfFactory.literal("wrong"),
                ]);
        });
    });

    describe("deleteRecord", () => {
        const recordId = "/resource/4";

        it("clears the status", () => {
            const store = new StructuredStore(defaultGraph.value, {});
            store.journal.transition(recordId, RecordState.Present);

            expect(store.getStatus(recordId).current).toEqual(RecordState.Present);

            store.deleteRecord(recordId);

            expect(store.getStatus(recordId).current).toEqual(RecordState.Absent);
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
            const store = new StructuredStore(defaultGraph.value, createData());

            expect(store.getField(recordId, "count")).toEqual(rdfFactory.literal(2));
            store.deleteFieldMatching(recordId, "count", rdfFactory.literal(1));
            expect(store.getField(recordId, "count")).toEqual(rdfFactory.literal(2));
        });

        it("deletes matching value", () => {
            const store = new StructuredStore(defaultGraph.value, createData());

            expect(store.getField(recordId, "count")).toEqual(rdfFactory.literal(2));
            store.deleteFieldMatching(recordId, "count", rdfFactory.literal(2));
            expect(store.getField(recordId, "count")).toBeUndefined();
        });

        it("preserves different multimap value", () => {
            const store = new StructuredStore(defaultGraph.value, createData());

            expect(store.getField(recordId, "name")).toContainEqual(rdfFactory.literal("name2"));
            store.deleteFieldMatching(recordId, "name", rdfFactory.literal("name3"));
            expect(store.getField(recordId, "name")).toContainEqual(rdfFactory.literal("name2"));
        });

        it("deletes matching multimap value", () => {
            const store = new StructuredStore(defaultGraph.value, createData());

            expect(store.getField(recordId, "name")).toContainEqual(rdfFactory.literal("name2"));
            store.deleteFieldMatching(recordId, "name", rdfFactory.literal("name2"));
            expect(store.getField(recordId, "name")).not.toContainEqual(rdfFactory.literal("name2"));
        });
    });

    describe("references", () => {
        it("works with an empty store", () => {
            const store = new StructuredStore(defaultGraph.value);

            const references = store.references(rdfFactory.blankNode());

            expect(references).toEqual([]);
        });

        it("skips without references", () => {
            const store = new StructuredStore(defaultGraph.value, {
                "/resource/4": {
                    _id: rdfFactory.namedNode("/resource/4"),
                    [rdf.type.value]: schema.Thing,
                },
            });

            const references = store.references(rdfFactory.blankNode());

            expect(references).toEqual([]);
        });

        it("works with single reference", () => {
            const store = new StructuredStore(defaultGraph.value, {
                "/resource/3": {
                    _id: rdfFactory.namedNode("/resource/3"),
                    [rdf.type.value]: schema.Thing,
                    [schema.comment.value]: rdfFactory.namedNode("/resource/4"),
                },
                "/resource/4": {
                    _id: rdfFactory.namedNode("/resource/4"),
                    [rdf.type.value]: schema.Thing,
                },
            });

            const references = store.references("/resource/4");

            expect(references).toEqual([
                "/resource/3",
            ]);
        });

        it("works with array reference", () => {
            const store = new StructuredStore(defaultGraph.value, {
                "/resource/3": {
                    _id: rdfFactory.namedNode("/resource/3"),
                    [rdf.type.value]: schema.Thing,
                    [schema.comment.value]: [
                        rdfFactory.namedNode("/resource/2"),
                        rdfFactory.namedNode("/resource/4"),
                        rdfFactory.namedNode("/resource/5"),
                    ],
                },
                "/resource/4": {
                    _id: rdfFactory.namedNode("/resource/4"),
                    [rdf.type.value]: schema.Thing,
                },
            });

            const references = store.references("/resource/4");

            expect(references).toEqual([
                "/resource/3",
            ]);
        });
    });

    describe("collectRecord", () => {
        it("works with single reference", () => {
            const blank = rdfFactory.blankNode();
            const store = new StructuredStore(defaultGraph.value, {
                "/resource/3": {
                    _id: rdfFactory.namedNode("/resource/3"),
                    [rdf.type.value]: schema.Thing,
                    [schema.comment.value]: blank,
                },
                [blank.value]: {
                    _id: blank,
                    [rdf.type.value]: schema.CreativeWork,
                },
            });

            const collected = store.collectRecord("/resource/3");

            expect(collected).toEqual({
                _id: rdfFactory.namedNode("/resource/3"),
                [rdf.type.value]: schema.Thing,
                [schema.comment.value]: {
                    _id: blank,
                    [rdf.type.value]: schema.CreativeWork,
                },
            });
        });
    });
});
