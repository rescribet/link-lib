import rdfFactory from "@ontologies/core";
import * as rdfs from "@ontologies/rdfs";
import { getBasicStore } from "../../testUtilities";
import { ResourceQueueItem } from "../../types";

import {
    creativeWorkStatements,
    schemaCW,
    schemaT,
    thingStatements,
} from "./fixtures";

describe("LinkedRenderStore", () => {
    describe("adds new graph items", () => {
        it("add a single graph item", () => {
            const store = getBasicStore();
            store.lrs.addOntologySchematics(thingStatements);
            expect(store.schema.isInstanceOf(rdfFactory.id(schemaT), rdfFactory.id(rdfs.Class))).toBeTruthy();
        });

        it("adds multiple graph items", () => {
            const store = getBasicStore();
            store.lrs.addOntologySchematics(thingStatements.concat(creativeWorkStatements));
            expect(store.schema.isInstanceOf(rdfFactory.id(schemaT), rdfFactory.id(rdfs.Class))).toBeTruthy();
            expect(store.schema.isInstanceOf(rdfFactory.id(schemaCW), rdfFactory.id(rdfs.Class))).toBeTruthy();
        });
    });

    describe("#getResourceProperties", () => {
        const store = getBasicStore();
        store.lrs.addOntologySchematics(thingStatements);

        it("returns empty data for empty subject", () => {
            const res = store.lrs.getResourceProperties(undefined, rdfs.label);
            expect(res).toEqual([]);
        });

        it("returns empty data for empty property", () => {
            const res = store.lrs.getResourceProperties(schemaT, undefined);
            expect(res).toEqual([]);
        });

        it("returns data when available", () => {
            const res = store.lrs.getResourceProperties(schemaT, rdfs.label);
            expect(res).toEqual([rdfFactory.literal("Thing.")]);
        });
    });

    describe("#getResourceProperty", () => {
        const store = getBasicStore();
        store.lrs.addOntologySchematics(thingStatements);

        it("returns empty data for empty subject", () => {
            const res = store.lrs.getResourceProperty(undefined, rdfs.label);
            expect(res).toEqual(undefined);
        });

        it("returns empty data for empty property", () => {
            const res = store.lrs.getResourceProperty(schemaT, undefined);
            expect(res).toEqual(undefined);
        });

        it("returns data when available", () => {
            const res = store.lrs.getResourceProperty(schemaT, rdfs.label);
            expect(res).toEqual(rdfFactory.literal("Thing."));
        });
    });

    describe("#getResourcePropertyRaw", () => {
        const store = getBasicStore();
        store.lrs.addOntologySchematics(thingStatements);

        it("returns empty data for empty subject", () => {
            const res = store.lrs.getResourcePropertyRaw(undefined, rdfs.label);
            expect(res).toEqual([]);
        });

        it("returns empty data for empty property", () => {
            const res = store.lrs.getResourcePropertyRaw(schemaT, undefined);
            expect(res).toEqual([]);
        });

        it("returns data when available", () => {
            const res = store.lrs.getResourcePropertyRaw(schemaT, rdfs.label);
            expect(res).toEqual([rdfFactory.quad(schemaT, rdfs.label, rdfFactory.literal("Thing."))]);
        });
    });

    describe("#removeResource", () => {
        it("resolves after removal", async () => {
            const store = getBasicStore();
            store.store.addQuads([
                ...thingStatements,
                ...creativeWorkStatements,
            ]);
            store.store.flush();
            const res = await store.lrs.removeResource(schemaT);

            expect(res).toBeUndefined();
        });

        it("removes the resource", async () => {
            const store = getBasicStore();
            store.store.addQuads([
                ...thingStatements,
                ...creativeWorkStatements,
            ]);
            store.store.flush();
            await store.lrs.removeResource(schemaT);

            expect(store.lrs.tryEntity(schemaT)).toHaveLength(0);
        });

        it("calls the subscriber", async () => {
            const store = getBasicStore();
            const sub = jest.fn();
            store.lrs.subscribe({
                callback: sub,
                markedForDelete: false,
                onlySubjects: true,
                subjectFilter: [schemaT],
            });
            store.store.addQuads([
                ...thingStatements,
                ...creativeWorkStatements,
            ]);
            store.store.flush();
            await store.lrs.removeResource(schemaT, true);

            expect(sub).toHaveBeenCalledTimes(1);
        });
    });

    describe("#processResourceQueue", () => {
        it("swaps the queue on processing start", async () => {
            const store = getBasicStore();
            const queue: ResourceQueueItem[] = [
              [schemaT, { reload: false }],
            ];

            (store.lrs as any).resourceQueue = queue;
            (store.lrs as any).resourceQueueHandle = 0;
            await (store.lrs as any).processResourceQueue();

            expect((store.lrs as any).resourceQueueHandle).toBeUndefined();
            expect((store.lrs as any).resourceQueue).not.toBe(queue);
        });
    });
});
