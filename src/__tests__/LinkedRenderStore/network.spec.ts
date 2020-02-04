import "jest";
import "../useHashFactory";

import rdfFactory from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import schema from "@ontologies/schema";

import { getBasicStore } from "../../testUtilities";

import { ex, example } from "./fixtures";

describe("LinkedRenderStore", () => {
    describe("#execActionByIRI", () => {
        const store = getBasicStore();
        const action = example("location/everest/pictures/create");
        const entryPoint = example("location/everest/pictures/create#entrypoint");
        const actionStatements = [
            rdfFactory.quad(action, rdf.type, schema.CreateAction),
            rdfFactory.quad(action, schema.name, rdfFactory.literal("Upload a picture of Mt. Everest!")),
            rdfFactory.quad(action, schema.object, example("location/everest")),
            rdfFactory.quad(action, schema.result, schema.ImageObject),
            rdfFactory.quad(action, schema.target, example("location/everest/pictures/create#entrypoint")),

            rdfFactory.quad(entryPoint, rdf.type, schema.EntryPoint),
            rdfFactory.quad(entryPoint, schema.httpMethod, rdfFactory.literal("POST")),
            rdfFactory.quad(entryPoint, schema.url, example("location/everest/pictures")),
            rdfFactory.quad(entryPoint, schema.image, rdfFactory.namedNode("http://fontawesome.io/icon/plus")),
            rdfFactory.quad(entryPoint, schema.name, rdfFactory.literal("Add a picture")),
        ];
        store.store.addHextuples(actionStatements);

        it("sends the described request", async () => {
            const sub = jest.fn();
            store.lrs.subscribe({ callback: sub, markedForDelete: false, onlySubjects: false });

            const response = await store.lrs.execActionByIRI(action);

            expect(response).toEqual({
                data: [],
                iri: null,
            });
            expect(sub).toHaveBeenCalledTimes(1);
        });
    });

    describe("#getStatus", () => {
        it("resolves empty status for blank nodes", () => {
            const store = getBasicStore();
            const resource = rdfFactory.blankNode();
            const status = store.lrs.getStatus(resource);

            expect(status).toHaveProperty("status", null);
        });

        it("resolves queued status for resources in the queue", () => {
            const store = getBasicStore();
            const resource = example("test");
            store.lrs.queueEntity(resource);
            const status = store.lrs.getStatus(resource);

            expect(status).toHaveProperty("status", 202);
        });

        it("delegates to the api for other resources", () => {
            const store = getBasicStore();
            const resource = example("test");
            const exStatus = { status: 259 };
            (store.processor as any).statusMap[resource] = exStatus;
            const status = store.lrs.getStatus(resource);

            expect(status).toHaveProperty("status", 259);
        });
    });

    describe("#shouldLoadResource", () => {
        const resource = example("test");

        it("should load nonexistent resources", () => {
            const store = getBasicStore();
            store.store.flush();

            expect(store.lrs.shouldLoadResource(resource)).toBeTruthy();
        });

        it("should load invalidated resources", () => {
            const store = getBasicStore();
            store.store.addHextuples([
                rdfFactory.quad(resource, rdfs.label, rdfFactory.literal("test")),
            ]);
            store.store.flush();
            store.processor.invalidate(resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeTruthy();
        });

        it("should not load existent resources", () => {
            const store = getBasicStore();
            store.store.addHextuples([
                rdfFactory.quad(resource, rdfs.label, rdfFactory.literal("test")),
            ]);
            store.store.flush();

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
        });

        it("should not load queued resources", () => {
            const store = getBasicStore();
            store.store.flush();
            store.lrs.queueEntity(resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
        });

        it("should not queue resources being fetched", () => {
            const store = getBasicStore();
            store.store.flush();
            store.lrs.api.getEntities([[resource, undefined]]);

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
        });

        it("should not load invalidated queued resources", () => {
            const store = getBasicStore();
            store.store.flush();
            store.store.addHextuples([
                rdfFactory.quad(resource, rdfs.label, rdfFactory.literal("test")),
            ]);
            store.store.flush();
            store.processor.invalidate(resource);
            store.lrs.queueEntity(resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
        });
    });

    describe("#tryEntity", () => {
        it("resolves statements for the resource", () => {
            const store = getBasicStore();
            const resource = ex("1");
            const testData = [
                rdfFactory.quad(resource, rdf.type, ex("Organization")),
                rdfFactory.quad(resource, schema.name, rdfFactory.literal("Some org")),
                rdfFactory.quad(resource, schema.employee, ex("2")),
            ];
            store.store.addHextuples(testData);
            store.store.flush();

            const data = store.lrs.tryEntity(resource);
            expect(data).toHaveLength(3);
            expect(data).toContainEqual(testData[0]);
            expect(data).toContainEqual(testData[1]);
            expect(data).toContainEqual(testData[2]);
        });
    });
});
