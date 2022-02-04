import "jest";
import "../useFactory";

import rdfFactory, { NamedNode, Quadruple } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";

import { getBasicStore } from "../../testUtilities";
import { ResourceQueueItem } from "../../types";

import { ex, example } from "./fixtures";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();

describe("LinkedRenderStore", () => {
    describe("#execActionByIRI", () => {
        const store = getBasicStore();
        const action = example("location/everest/pictures/create");
        const entryPoint = example("location/everest/pictures/create#entrypoint");
        const actionStatements: Quadruple[] = [
            [action, rdf.type, schema.CreateAction, defaultGraph],
            [action, schema.name, rdfFactory.literal("Upload a picture of Mt. Everest!"), defaultGraph],
            [action, schema.object, example("location/everest"), defaultGraph],
            [action, schema.result, schema.ImageObject, defaultGraph],
            [action, schema.target, example("location/everest/pictures/create#entrypoint"), defaultGraph],

            [entryPoint, rdf.type, schema.EntryPoint, defaultGraph],
            [entryPoint, schema.httpMethod, rdfFactory.literal("POST"), defaultGraph],
            [entryPoint, schema.url, example("location/everest/pictures"), defaultGraph],
            [entryPoint, schema.image, rdfFactory.namedNode("http://fontawesome.io/icon/plus"), defaultGraph],
            [entryPoint, schema.name, rdfFactory.literal("Add a picture"), defaultGraph],
        ];
        store.store.addQuads(actionStatements);

        it("sends the described request", async () => {
            const sub = jest.fn();
            store.lrs.subscribe({ callback: sub, markedForDelete: false });

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
            (store.processor as any).statusMap[resource.value] = exStatus;
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
            store.store.add(resource, rdfs.label, rdfFactory.literal("test"));
            store.store.flush();
            store.processor.invalidate(resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeTruthy();
        });

        it("should not load existent resources", () => {
            const store = getBasicStore();
            store.store.add(resource, rdfs.label, rdfFactory.literal("test"));
            store.store.flush();

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
        });

        it("should not queue loaded resources", () => {
            const store = getBasicStore();
            store.lrs.queueDelta([
                [resource, rdf.type, schema.CreateAction, defaultGraph],
            ]);
            store.store.flush();
            store.lrs.queueEntity(resource);
            const queueItem = (store.lrs as any).resourceQueue
              .find(([iri]: ResourceQueueItem) => iri === resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
            expect(queueItem).not.toBeDefined();
        });

        it("should not load queued resources", () => {
            const store = getBasicStore();
            store.store.flush();
            store.lrs.queueEntity(resource);
            const queueItem = (store.lrs as any).resourceQueue
              .find(([iri]: ResourceQueueItem) => iri === resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
            expect(queueItem).toBeDefined();
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
            store.store.add(resource, rdfs.label, rdfFactory.literal("test"));
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
            const testData: Quadruple[] = [
                [resource, rdf.type, ex("Organization"), defaultGraph],
                [resource, schema.name, rdfFactory.literal("Some org"), defaultGraph],
                [resource, schema.employee, ex("2"), defaultGraph],
            ];
            store.store.addQuads(testData);
            store.store.flush();

            const data = store.lrs.tryEntity(resource);
            const contains = (compare: Quadruple): (q: Quadruple) => boolean =>
                (q: Quadruple): boolean => q[0] === compare[0]
                    && q[1] === compare[1]
                    && q[2] === compare[2]
                    && q[3] === compare[3];

            expect(data).toHaveLength(3);
            expect(data.some(contains(testData[0]))).toBeTruthy();
            expect(data.some(contains(testData[1]))).toBeTruthy();
            expect(data.some(contains(testData[2]))).toBeTruthy();
        });
    });
});
