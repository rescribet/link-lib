import rdfFactory from "@ontologies/core";
import * as rdfs from "@ontologies/rdfs";
import { getBasicStore } from "../../testUtilities";

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
});
