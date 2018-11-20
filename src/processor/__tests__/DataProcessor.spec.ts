import {
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
} from "http-status-codes";
import "jest";
import { BlankNode, IndexedFormula, Literal, Statement } from "rdflib";

import { getBasicStore } from "../../testUtilities";
import { FulfilledRequestStatus, ResponseAndFallbacks } from "../../types";

import {
    defaultNS,
    MSG_INCORRECT_TARGET,
    MSG_OBJECT_NOT_IRI,
    MSG_URL_UNDEFINED,
    MSG_URL_UNRESOLVABLE,
} from "../../utilities/constants";
import { emptyRequest } from "../DataProcessor";
import {
    ProcessorError,
} from "../ProcessorError";

const getFulfilledRequest = (): FulfilledRequestStatus => {
    return {
        lastRequested: new Date(),
        lastResponseHeaders: null,
        requested: true,
        status: 200,
        timesRequested: 1,
    };
};

describe("DataProcessor", () => {
    describe("#execActionByIRI", () => {
        it("throws an error when the action doesn't exists", async () => {
            const store = getBasicStore();

            const subject = defaultNS.example("actions/5");
            let error;
            try {
                await store.processor.execActionByIRI(subject, [new IndexedFormula(), []]);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_OBJECT_NOT_IRI);
        });

        it("throws an error when the target isn't a node", async () => {
            const store = getBasicStore();

            const subject = defaultNS.example("actions/5");
            store.store.addStatements([
                new Statement(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                new Statement(subject, defaultNS.schema("target"), new Literal("targets/5")),
            ]);

            let error;
            try {
                await store.processor.execActionByIRI(subject, [new IndexedFormula(), []]);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_INCORRECT_TARGET);
        });

        it("throws an error when the url is undefined", async () => {
            const store = getBasicStore();

            const subject = defaultNS.example("actions/5");
            store.store.addStatements([
                new Statement(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                new Statement(subject, defaultNS.schema("target"), defaultNS.example("targets/5")),
            ]);

            let error;
            try {
                await store.processor.execActionByIRI(subject, [new IndexedFormula(), []]);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_URL_UNDEFINED);
        });

        it("throws an error when the url is a blank node", async () => {
            const store = getBasicStore();

            const subject = defaultNS.example("actions/5");
            store.store.addStatements([
                new Statement(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                new Statement(subject, defaultNS.schema("target"), defaultNS.example("targets/5")),
                new Statement(defaultNS.example("targets/5"), defaultNS.schema("url"), new BlankNode()),
            ]);

            let error;
            try {
                await store.processor.execActionByIRI(subject, [new IndexedFormula(), []]);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_URL_UNRESOLVABLE);
        });

        it("calls processExecAction", async () => {
            const store = getBasicStore();
            const subject = defaultNS.example("actions/5");
            store.store.addStatements([
                new Statement(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                new Statement(subject, defaultNS.schema("target"), defaultNS.example("targets/5")),
                new Statement(defaultNS.example("targets/5"), defaultNS.schema("url"), defaultNS.example("test")),
            ]);

            const process = jest.fn((res) => Promise.resolve(res));
            // @ts-ignore
            store.processor.processExecAction = process;

            await store.processor.execActionByIRI(subject, [new IndexedFormula(), []]);

            expect(process).toHaveBeenCalledTimes(1);
        });
    });

    describe("#fetchResource", () => {
        it("calls processExecAction", async () => {
            const store = getBasicStore();

            const process = jest.fn((res) => Promise.resolve(res));
            // @ts-ignore
            store.processor.processExecAction = process;

            await store.processor.fetchResource(defaultNS.example("test"));

            expect(process).toHaveBeenCalledTimes(1);
        });
    });

    describe("#getStatus", () => {
        it("returns the empty status if unfetched", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/1");

            const status = store.processor.getStatus(subject);

            expect(status).toEqual(emptyRequest);
        });

        it("returns a memoized status if present", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/1");
            const request = getFulfilledRequest();

            // @ts-ignore
            store.processor.memoizeStatus(subject, request);

            const status = store.processor.getStatus(subject);

            expect(status).toEqual(request);
        });

        it("checks for the base document", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/1#subDocument");
            const request = getFulfilledRequest();

            // @ts-ignore
            store.processor.memoizeStatus(defaultNS.example("resource/1"), request);

            const status = store.processor.getStatus(subject);

            expect(status).toEqual(request);
        });
    });

    describe("#invalidateCache", () => {
        it("returns true to resubscribe", () => {
            // @ts-ignore
            expect(getBasicStore().processor.invalidateCache(defaultNS.example("test"))).toEqual(true);
        });

        it("removes the item from the map", () => {
            const store = getBasicStore();
            // @ts-ignore
            const map = store.processor.statusMap;
            map.set(defaultNS.example("test"), emptyRequest);

            expect(map.size).toEqual(1);
            // @ts-ignore
            store.processor.invalidateCache(defaultNS.example("test"));
            expect(map.size).toEqual(0);
        });
    });

    describe("#processExecAction", () => {
        it("resolves when the header is blank", async () => {
            const store = getBasicStore();

            const dispatch = jest.fn();
            store.processor.dispatch = dispatch;
            const res = new Response();

            // @ts-ignore TS-2341
            const response = await store.processor.processExecAction(res);

            expect(dispatch).toHaveBeenCalledTimes(0);
            expect(response).toEqual(res);
        });

        it("executes a single action", async () => {
            const store = getBasicStore();

            const dispatch = jest.fn();
            store.processor.dispatch = dispatch;

            const headers = new Headers();
            headers.append("Exec-Action", defaultNS.example("action/something?text=Hello%20world").value);
            const res = new Response(null, { headers });

            // @ts-ignore TS-2341
            await store.processor.processExecAction(res);

            expect(dispatch)
                .toHaveBeenNthCalledWith(1, defaultNS.example("action/something?text=Hello%20world"), undefined);
        });

        it("executes multiple actions", async () => {
            const store = getBasicStore();

            const dispatch = jest.fn();
            store.processor.dispatch = dispatch;

            const headers = new Headers();
            const action0 = defaultNS.example("action/something?text=Hello%20world");
            const action1 = defaultNS.example("action/other");
            const action2 = defaultNS.example("action");
            headers.append("Exec-Action", [action0.value, action1.value, action2.value].join(", "));
            const res = new Response(null, { headers });

            // @ts-ignore TS-2341
            await store.processor.processExecAction(res);

            expect(dispatch).toHaveBeenNthCalledWith(1, action0, undefined);
            expect(dispatch).toHaveBeenNthCalledWith(2, action1, undefined);
            expect(dispatch).toHaveBeenNthCalledWith(3, action2, undefined);
        });
    });

    describe("#processExternalResponse", () => {
        it("handles blank responses", async () => {
            const store = getBasicStore();

            const res = new Response();
            const data = await store.processor.processExternalResponse(res);

            expect(data).toHaveLength(0);
        });

        it("rejects for not-found responses", async () => {
            const store = getBasicStore();

            const res = new Response(null, { status: NOT_FOUND });
            expect(store.processor.processExternalResponse(res)).rejects.toBeTruthy();
        });

        it("rejects for client errors", async () => {
            const store = getBasicStore();

            const res = new Response(null, { status: BAD_REQUEST });
            expect(store.processor.processExternalResponse(res)).rejects.toBeTruthy();
        });

        it("rejects for server errors", async () => {
            const store = getBasicStore();

            const res = new Response(null, { status: INTERNAL_SERVER_ERROR });
            expect(store.processor.processExternalResponse(res)).rejects.toBeTruthy();
        });
    });

    describe("#registerTransformer", () => {
        it("registers a transformer", () => {
            const store = getBasicStore();
            // @ts-ignore
            const mapping = store.processor.mapping;

            const transformer = (_res: ResponseAndFallbacks): Promise<Statement[]> => Promise.resolve([]);

            store.processor.registerTransformer(transformer, "text/n3", 0.9);

            expect(mapping["text/n3"]).toContain(transformer);
            expect(mapping["application/n-quads"]).not.toBeDefined();
            expect(store.processor.accept.default).toEqual(",text/n3;0.9");
        });
    });

    describe("#setAcceptForHost", () => {
        it("sets the value and trims to origin", () => {
            const store = getBasicStore();

            store.processor.setAcceptForHost("https://example.org/4321", "text/n3");

            expect(store.processor.accept["https://example.org/4321"]).toBeUndefined();
            expect(store.processor.accept["https://example.org"]).toEqual("text/n3");
        });
    });
});
