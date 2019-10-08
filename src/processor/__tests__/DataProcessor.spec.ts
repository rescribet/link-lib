import "../../__tests__/useHashFactory";

import rdfFactory from "@ontologies/core";
import {
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
} from "http-status-codes";
import "jest";

import { rdflib, RequestInitGenerator } from "../../link-lib";
import { Quad } from "../../rdf";

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
                await store.processor.execActionByIRI(subject, [new rdflib.IndexedFormula(), []]);
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
                rdfFactory.quad(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                rdfFactory.quad(subject, defaultNS.schema("target"), rdfFactory.literal("targets/5")),
            ]);

            let error;
            try {
                await store.processor.execActionByIRI(subject, [new rdflib.IndexedFormula(), []]);
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
                rdfFactory.quad(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                rdfFactory.quad(subject, defaultNS.schema("target"), defaultNS.example("targets/5")),
            ]);

            let error;
            try {
                await store.processor.execActionByIRI(subject, [new rdflib.IndexedFormula(), []]);
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
                rdfFactory.quad(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                rdfFactory.quad(subject, defaultNS.schema("target"), defaultNS.example("targets/5")),
                rdfFactory.quad(defaultNS.example("targets/5"), defaultNS.schema("url"), rdfFactory.blankNode()),
            ]);

            let error;
            try {
                await store.processor.execActionByIRI(subject, [new rdflib.IndexedFormula(), []]);
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
                rdfFactory.quad(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                rdfFactory.quad(subject, defaultNS.schema("target"), defaultNS.example("targets/5")),
                rdfFactory.quad(defaultNS.example("targets/5"), defaultNS.schema("url"), defaultNS.example("test")),
            ]);

            const process = jest.fn((res) => Promise.resolve(res));
            // @ts-ignore
            store.processor.processExecAction = process;

            await store.processor.execActionByIRI(subject, [new rdflib.IndexedFormula(), []]);

            expect(process).toHaveBeenCalledTimes(1);
        });
    });

    describe("#feedResponse", () => {
        it("rejects error responses", () => {
            const store = getBasicStore();
            const res = { status: 500 };

            expect((store.processor as any).feedResponse(res)).rejects.toEqual(res);
        });

        it("processes valid responses", () => {
            const store = getBasicStore();
            const processor = jest.fn();
            const res = {
                headers: {
                    "Content-Type": "application/n-quads",
                },
                status: 200,
            };

            store.processor.registerTransformer(processor, "application/n-quads", 1);
            (store.processor as any).feedResponse(res);

            expect(processor).toHaveBeenCalledWith(res);
        });
    });

    describe("#getEntity", () => {
        it("non-fetchable url with CORS", async () => {
            const store = getBasicStore({
                apiOpts: {
                    fetch: (_, __): Promise<Response> => {
                        throw new Error("Test triggered error");
                    },
                    requestInitGenerator: new RequestInitGenerator({
                        credentials: "include",
                        csrfFieldName: "",
                        mode: "cors",
                        xRequestedWith: "XMLHttpRequest",
                    }),
                },
            });

            try {
                const res = await store
                    .processor
                    .getEntity(rdfFactory.namedNode("about:bookmarks"));

                expect(res).toBeInstanceOf(Array);
            } catch (e) {
                expect(e).toBeFalsy();
            }
        });
    });

    describe("#getEntities", () => {
        beforeEach(() => {
            (fetch as any).resetMocks();
        });

        it("requests the resources iris in the body", async () => {
            const fetchMock = (fetch as any);
            fetchMock.mockResponse("/link-lib/bulk", 200);
            const store = getBasicStore();

            await store.processor.getEntities([
                [defaultNS.ex("a"), undefined],
                [defaultNS.ex("b"), { reload: true }],
            ]);

            expect(fetchMock.mock.calls[0]).toBeDefined();
            const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
            const resources = body.getAll("resource[]");
            expect(resources).toHaveLength(2);
            expect(resources).toContain(encodeURIComponent(defaultNS.ex("a").value));
            expect(resources).toContain(encodeURIComponent(defaultNS.ex("b").value));
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
            const subject = defaultNS.example("resource/2");
            const request = getFulfilledRequest();

            // @ts-ignore
            store.processor.memoizeStatus(subject, request);

            const status = store.processor.getStatus(subject);

            expect(status).toEqual(request);
        });

        it("checks for the base document", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/3#subDocument");
            const request = getFulfilledRequest();

            // @ts-ignore
            store.processor.memoizeStatus(defaultNS.example("resource/3"), request);

            const status = store.processor.getStatus(subject);

            expect(status).toEqual(request);
        });

        it("resolves an empty request when not touched by the fetcher", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/4");

            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", false);
            expect(status).toHaveProperty("status", null);
        });

        it("resolves an empty request when not processed by the fetcher", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/5");

            (store.processor as any).fetcher.requested[subject.value] = "";
            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", false);
            expect(status).toHaveProperty("status", null);
        });

        it("resolves a failed status when the fetcher has explicit empty status", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/5");

            (store.processor as any).fetcher.requested[subject.value] = undefined;
            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", true);
            expect(status).toHaveProperty("status", 499);
        });

        it("resolves accepted when the fetcher has a true status", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/6");

            store.store.addStatements([
                rdfFactory.quad(
                    rdfFactory.blankNode(),
                    defaultNS.link("requestedURI"),
                    rdfFactory.literal(subject.value),
                ),
            ]);
            (store.processor as any).fetcher.requested[subject.value] = true;
            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", true);
            expect(status).toHaveProperty("status", 202);
        });

        it("resolves empty with fetcher info but without request object", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/6");

            const requestInfo = rdfFactory.blankNode();
            store.store.addStatements([
                rdfFactory.quad(requestInfo, defaultNS.link("requestedURI"), rdfFactory.literal(subject.value)),
            ]);
            (store.processor as any).fetcher.requested[subject.value] = "other";
            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", false);
            expect(status).toHaveProperty("status", null);
        });

        it("resolves a timeout status when the fetcher has a timeout status", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/6");

            store.store.addStatements([
                rdfFactory.quad(
                    rdfFactory.blankNode(),
                    defaultNS.link("requestedURI"),
                    rdfFactory.literal(subject.value),
                ),
            ]);
            (store.processor as any).fetcher.requested[subject.value] = "timeout";
            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", true);
            expect(status).toHaveProperty("status", 408);
        });

        it("resolves a timeout when the fetcher has a done status without a store status", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/6");

            const response = rdfFactory.blankNode();
            const requestInfo = rdfFactory.blankNode();
            const requestDate = new Date();
            store.store.addStatements([
                rdfFactory.quad(requestInfo, defaultNS.link("requestedURI"), rdfFactory.literal(subject.value)),
                rdfFactory.quad(requestInfo, defaultNS.link("response"), response),
                rdfFactory.quad(response, defaultNS.httph("date"), rdfFactory.literal(requestDate.toISOString())),
            ]);
            (store.processor as any).fetcher.requested[subject.value] = "done";
            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", true);
            expect(status).toHaveProperty("status", 408);
        });

        it("resolves a timeout when the fetcher has an other status without a store status", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/6");

            const response = rdfFactory.blankNode();
            const requestInfo = rdfFactory.blankNode();
            const requestDate = new Date();
            store.store.addStatements([
                rdfFactory.quad(requestInfo, defaultNS.link("requestedURI"), rdfFactory.literal(subject.value)),
                rdfFactory.quad(requestInfo, defaultNS.link("response"), response),
                rdfFactory.quad(response, defaultNS.httph("date"), rdfFactory.literal(requestDate.toISOString())),
            ]);
            (store.processor as any).fetcher.requested[subject.value] = "other";
            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", false);
            expect(status).toHaveProperty("status", null);
        });

        it("resolves the request status when the fetcher has a done status", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/6");

            const response = rdfFactory.blankNode();
            const requestInfo = rdfFactory.blankNode();
            const requestDate = new Date();
            store.store.addStatements([
                rdfFactory.quad(requestInfo, defaultNS.link("requestedURI"), rdfFactory.literal(subject.value)),
                rdfFactory.quad(requestInfo, defaultNS.link("response"), response),
                rdfFactory.quad(response, defaultNS.httph("status"), rdfFactory.literal(259)),
                rdfFactory.quad(response, defaultNS.httph("date"), rdfFactory.literal(requestDate.toISOString())),
            ]);
            (store.processor as any).fetcher.requested[subject.value] = "done";
            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", true);
            expect(status).toHaveProperty("status", 259);
            expect(status).toHaveProperty("lastRequested", requestDate);
        });

        it("resolves the request status when the fetcher has a done status", () => {
            const store = getBasicStore();
            const subject = defaultNS.example("resource/6");

            const response = rdfFactory.blankNode();
            const requestInfo = rdfFactory.blankNode();
            const requestDate = new Date();
            store.store.addStatements([
                rdfFactory.quad(requestInfo, defaultNS.link("requestedURI"), rdfFactory.literal(subject.value)),
                rdfFactory.quad(requestInfo, defaultNS.link("response"), response),
                rdfFactory.quad(response, defaultNS.httph("status"), rdfFactory.literal(259)),
                rdfFactory.quad(response, defaultNS.httph("date"), rdfFactory.literal(requestDate.toISOString())),
            ]);
            (store.processor as any).fetcher.requested[subject.value] = "done";
            const status = store.processor.getStatus(subject);

            expect(status).toHaveProperty("requested", true);
            expect(status).toHaveProperty("status", 259);
            expect(status).toHaveProperty("lastRequested", requestDate);
        });
    });

    describe("#invalidate", () => {
        it("returns true to resubscribe", () => {
            // @ts-ignore
            expect(getBasicStore().processor.invalidate(defaultNS.example("test"))).toEqual(true);
        });

        it("removes the item from the map", () => {
            const store = getBasicStore();
            // @ts-ignore
            const map = store.processor.statusMap;
            map[rdfFactory.id(defaultNS.example("test"))] = emptyRequest;

            expect(Object.values(map).filter(Boolean).length).toEqual(1);
            // @ts-ignore
            store.processor.invalidate(defaultNS.example("test"));
            expect(Object.values(map).filter(Boolean).length).toEqual(0);
        });

        it("marks the resource as invalidated", () => {
            const store = getBasicStore();
            expect(store.processor.isInvalid(defaultNS.example("test"))).toBeFalsy();
            store.processor.invalidate(defaultNS.example("test"));
            expect(store.processor.isInvalid(defaultNS.example("test"))).toBeTruthy();
        });
    });

    describe("#isInvalid", () => {
        it("returns true for invalidated resources", () => {
            const store = getBasicStore();
            store.processor.invalidate(defaultNS.example("test"));
            expect(store.processor.isInvalid(defaultNS.example("test"))).toBeTruthy();
        });

        it("returns false for non-invalidated resources", () => {
            const store = getBasicStore();
            store.processor.invalidate(defaultNS.example("other"));
            expect(store.processor.isInvalid(defaultNS.example("test"))).toBeFalsy();
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

    describe("#processDelta", () => {
        const resource = defaultNS.ex("1");

        it("processes empty deltas", () => {
            const store = getBasicStore();
            store.processor.processDelta([]);
        });

        it("ignores other deltas", () => {
            const store = getBasicStore();
            store.processor.processDelta([
                [resource, defaultNS.rdf("type"), defaultNS.schema("Thing"), rdfFactory.blankNode("chrome:theSession")],
            ]);
        });

        describe("when processing http:statusCode", () => {
            it("sets the status codes", () => {
                const store = getBasicStore();
                store.processor.processDelta([
                    [resource, defaultNS.http("statusCode"), rdfFactory.literal(200), defaultNS.ll("meta")],
                ]);

                expect(store.processor.getStatus(resource).status).toEqual(200);
            });

            it("clears the invalidation", () => {
                const store = getBasicStore();
                store.processor.invalidate(resource);
                store.processor.processDelta([
                    [resource, defaultNS.http("statusCode"), rdfFactory.literal(200), defaultNS.ll("meta")],
                ]);

                expect(store.processor.isInvalid(resource)).toBeFalsy();
            });
        });
    });

    describe("#queueDelta", () => {
        const resource = defaultNS.example("1");

        it("sets the status", () => {
            const store = getBasicStore();
            store.processor.queueDelta([], [rdfFactory.id(resource)]);

            expect(store.processor.getStatus(resource)).toHaveProperty("status", 203);
            expect(store.processor.getStatus(resource)).toHaveProperty("timesRequested", 1);
        });
    });

    describe("#registerTransformer", () => {
        it("registers a transformer", () => {
            const store = getBasicStore();
            // @ts-ignore
            const mapping = store.processor.mapping;

            const transformer = (_res: ResponseAndFallbacks): Promise<Quad[]> => Promise.resolve([]);

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
