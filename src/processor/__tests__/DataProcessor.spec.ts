import "../../__tests__/useHashFactory";

import rdfFactory, { NamedNode, Quadruple } from "@ontologies/core";
import * as rdfx from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";
import {
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
} from "http-status-codes";
import "jest";

import ex from "../../ontology/ex";
import example from "../../ontology/example";
import http from "../../ontology/http";
import ll from "../../ontology/ll";
import RDFIndex from "../../store/RDFIndex";
import { BasicComponent, ExplodedLRS, getBasicStore } from "../../testUtilities";
import { FulfilledRequestStatus, ResponseAndFallbacks } from "../../types";

import { RecordState } from "../../store/RecordState";
import {
    MSG_INCORRECT_TARGET,
    MSG_URL_UNDEFINED,
    MSG_URL_UNRESOLVABLE,
} from "../../utilities/constants";
import { emptyRequest } from "../DataProcessor";
import { ProcessorError } from "../ProcessorError";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();

const getFulfilledRequest = (subject: NamedNode): FulfilledRequestStatus => {
    return {
        lastRequested: new Date(),
        lastResponseHeaders: null,
        requested: true,
        status: 200,
        subject,
        timesRequested: 1,
    };
};

describe("DataProcessor", () => {
    describe("#execActionByIRI", () => {
        const subject = example.ns("actions/5");
        const object1: Quadruple = [subject, schema.object, example.ns("objects/1"), defaultGraph];
        const target5: Quadruple = [subject, schema.target, example.ns("targets/5"), defaultGraph];
        const exec = (store: ExplodedLRS<BasicComponent>): Promise<any> =>
            store.processor.execActionByIRI(subject, [new RDFIndex(), []]);

        it("throws an error when the action doesn't exists", async () => {
            const store = getBasicStore();

            let error;
            try {
                await exec(store);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_INCORRECT_TARGET);
        });

        it("throws an error when the target isn't a node", async () => {
            const store = getBasicStore();

            store.store.addQuads([
                object1,
                [subject, schema.target, rdfFactory.literal("targets/5"), defaultGraph],
            ]);

            let error;
            try {
                await exec(store);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_INCORRECT_TARGET);
        });

        it("throws an error when the url is undefined", async () => {
            const store = getBasicStore();

            store.store.addQuads([
                object1,
                target5,
            ]);

            let error;
            try {
                await exec(store);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_URL_UNDEFINED);
        });

        it("throws an error when the url is a blank node", async () => {
            const store = getBasicStore();

            store.store.addQuads([
                object1,
                target5,
                [example.ns("targets/5"), schema.url, rdfFactory.blankNode(), defaultGraph],
            ]);

            let error;
            try {
                await exec(store);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_URL_UNRESOLVABLE);
        });

        it("sets a request body", async () => {
            const store = getBasicStore();

            const url = example.ns("test");
            store.store.addQuads([
                object1,
                target5,
                [example.ns("targets/5"), schema.httpMethod, rdfFactory.literal("POST"), defaultGraph],
                [example.ns("targets/5"), schema.url, url, defaultGraph],
            ]);

            // @ts-ignore
            store.processor.processExecAction = jest.fn((res) => Promise.resolve(res));
            const fetch = jest.fn((res) => Promise.resolve(res));
            // @ts-ignore
            store.processor.fetch = fetch;
            const data = new RDFIndex();
            data.add(ll.targetResource, schema.name, rdfFactory.literal("body"));

            await store.processor.execActionByIRI(subject, [data, []]);

            expect(fetch).toHaveBeenCalledTimes(1);
            const [fetchUrl, req] = fetch.mock.calls[0];

            expect(fetchUrl).toEqual(url.value);
            expect(req.method).toEqual("POST");

            const body = req.body.get("<http://purl.org/link-lib/graph>");
            expect(body).toBeDefined();
            expect(body.name).toEqual("blob");
            expect(body.type).toEqual("application/n-triples");
        });

        it("calls processExecAction", async () => {
            const store = getBasicStore();

            store.store.addQuads([
                object1,
                target5,
                [example.ns("targets/5"), schema.url, example.ns("test"), defaultGraph],
            ]);

            const process = jest.fn((res) => Promise.resolve(res));
            // @ts-ignore
            store.processor.processExecAction = process;

            await exec(store);

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

    // The reason why this shouldn't throw is lost, since about:x can't be fetched.
    // describe("#getEntity", () => {
    //     it("non-fetchable url with CORS", async () => {
    //         const store = getBasicStore({
    //             apiOpts: {
    //                 fetch: (_, __): Promise<Response> => {
    //                     throw new Error("Test triggered error");
    //                 },
    //                 requestInitGenerator: new RequestInitGenerator({
    //                     credentials: "include",
    //                     csrfFieldName: "",
    //                     mode: "cors",
    //                     xRequestedWith: "XMLHttpRequest",
    //                 }),
    //             },
    //         });
    //
    //         try {
    //             const res = await store
    //                 .processor
    //                 .getEntity(rdfFactory.namedNode("about:bookmarks"));
    //
    //             expect(res).toBeInstanceOf(Array);
    //         } catch (e) {
    //             expect(e).toBeFalsy();
    //         }
    //     });
    // });

    describe("#getEntities", () => {
        beforeEach(() => {
            (fetch as any).resetMocks();
        });

        it("requests the resources iris in the body", async () => {
            const fetchMock = (fetch as any);
            fetchMock.mockResponse("/link-lib/bulk", 200);
            const store = getBasicStore();

            await store.processor.getEntities([
                [ex.ns("a"), undefined],
                [ex.ns("b"), { reload: true }],
            ]);

            expect(fetchMock.mock.calls[0]).toBeDefined();
            const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
            const resources = body.getAll("resource[]");
            expect(resources).toHaveLength(2);
            expect(resources).toContain(encodeURIComponent(ex.ns("a").value));
            expect(resources).toContain(encodeURIComponent(ex.ns("b").value));
        });
    });

    describe("#getStatus", () => {
        it("returns the empty status if unfetched", () => {
            const store = getBasicStore();
            const subject = example.ns("resource/1");

            const status = store.processor.getStatus(subject);

            expect(status).toEqual(emptyRequest);
        });

        it("returns a memoized status if present", () => {
            const store = getBasicStore();
            const subject = example.ns("resource/2");
            const request = getFulfilledRequest(subject);

            // @ts-ignore
            store.processor.memoizeStatus(subject, request);

            const status = store.processor.getStatus(subject);

            expect(status).toEqual(request);
        });

        it("checks for the base document", () => {
            const store = getBasicStore();
            const subject = example.ns("resource/3#subDocument");
            const request = getFulfilledRequest(subject);

            // @ts-ignore
            store.processor.memoizeStatus(example.ns("resource/3"), request);

            const status = store.processor.getStatus(subject);

            expect(status).toEqual(request);
        });
    });

    describe("#invalidate", () => {
        it("returns true to resubscribe", () => {
            // @ts-ignore
            expect(getBasicStore().processor.invalidate(example.ns("test"))).toEqual(true);
        });

        it("removes the item from the map", () => {
            const store = getBasicStore();
            // @ts-ignore
            const map = store.processor.statusMap;
            map[rdfFactory.id(example.ns("test"))] = emptyRequest;

            expect(Object.values(map).filter(Boolean).length).toEqual(1);
            // @ts-ignore
            store.processor.invalidate(example.ns("test"));
            expect(Object.values(map).filter(Boolean).length).toEqual(0);
        });

        it("marks the resource as invalidated", () => {
            const store = getBasicStore();
            expect(store.processor.isInvalid(example.ns("test"))).toBeFalsy();
            store.processor.invalidate(example.ns("test"));
            expect(store.processor.isInvalid(example.ns("test"))).toBeTruthy();
        });
    });

    describe("#isInvalid", () => {
        it("returns true for invalidated resources", () => {
            const store = getBasicStore();
            store.processor.invalidate(example.ns("test"));
            expect(store.processor.isInvalid(example.ns("test"))).toBeTruthy();
        });

        it("returns false for non-invalidated resources", () => {
            const store = getBasicStore();
            store.processor.invalidate(example.ns("other"));
            expect(store.processor.isInvalid(example.ns("test"))).toBeFalsy();
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
            headers.append("Exec-Action", example.ns("action/something?text=Hello%20world").value);
            const res = new Response(null, { headers });

            // @ts-ignore TS-2341
            await store.processor.processExecAction(res);

            expect(dispatch)
                .toHaveBeenNthCalledWith(1, example.ns("action/something?text=Hello%20world"), undefined);
        });

        it("executes multiple actions", async () => {
            const store = getBasicStore();

            const dispatch = jest.fn();
            store.processor.dispatch = dispatch;

            const headers = new Headers();
            const action0 = example.ns("action/something?text=Hello%20world");
            const action1 = example.ns("action/other");
            const action2 = example.ns("action");
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
        const resource = ex.ns("1");

        it("processes empty deltas", () => {
            const store = getBasicStore();
            store.processor.processDelta([]);
        });

        it("ignores other deltas", () => {
            const store = getBasicStore();
            store.processor.processDelta([
                [resource, rdfx.type, schema.Thing, rdfFactory.blankNode("chrome:theSession")],
            ]);
        });

        describe("when processing http:statusCode", () => {
            it("sets the status codes", () => {
                const store = getBasicStore();
                store.processor.processDelta([
                    [resource, http.statusCode, rdfFactory.literal(200), ll.meta],
                ]);

                expect(store.processor.getStatus(resource).status).toEqual(200);
            });

            it("clears the invalidation", () => {
                const store = getBasicStore();
                store.processor.invalidate(resource);
                store.processor.processDelta([
                    [resource, http.statusCode, rdfFactory.literal(200), ll.meta],
                ]);

                expect(store.processor.isInvalid(resource)).toBeFalsy();
            });
        });
    });

    describe("#save", () => {
        beforeEach(() => {
            (fetch as any).resetMocks();
        });

        it("posts a resource from the default graph", () => {
            const fetchMock = (fetch as any);
            fetchMock.mockResponse("/link-lib/bulk", 200);
            const store = getBasicStore();
            const data: Quadruple[] = [
                [schema.Person, rdfx.type, schema.Thing, defaultGraph],
                [schema.Person, rdfs.label, rdfFactory.literal("Person class"), defaultGraph],
            ];
            store.store.addQuads([
                // [schema.Person, rdfx.type, schema.RejectAction, schema.Person, defaultGraph],
                ...data,
            ]);

            store.processor.save(schema.Person);

            expect(fetchMock.mock.calls[0]).toBeDefined();
            expect(fetchMock.mock.calls[0][0]).toEqual("http://schema.org/Person");
            expect(fetchMock.mock.calls[0][1].body).toEqual((store.processor as any).serialize(data));
        });

        // it("posts a graph", () => {
        //     const fetchMock = (fetch as any);
        //     fetchMock.mockResponse("/link-lib/bulk", 200);
        //     const store = getBasicStore();
        //     const blankNode = rdfFactory.blankNode();
        //     const data = [
        //         [schema.Person, rdfx.type, schema.Thing, schema.Person, defaultGraph],
        //         [schema.Person, rdfs.label, rdfFactory.literal("Person class"), schema.Person, defaultGraph],
        //         [blankNode, rdfs.label, rdfFactory.literal("included"), schema.Person, defaultGraph],
        //     ];
        //     store.store.addQuads([
        //         [schema.Person, rdfx.type, schema.RejectAction, rdfFactory.defaultGraph(), defaultGraph],
        //         ...data,
        //     ]);
        //
        //     store.processor.save(schema.Person, { useDefaultGraph: false });
        //
        //     expect(fetchMock.mock.calls[0]).toBeDefined();
        //     expect(fetchMock.mock.calls[0][0]).toEqual("http://schema.org/Person");
        //     expect(fetchMock.mock.calls[0][1].body).toEqual((store.processor as any).serialize(data));
        // });

        it("throws on blank node without backing url", () => {
            expect(() => {
                getBasicStore().processor.save(rdfFactory.blankNode());
            }).toThrow("Can't resolve");
        });

        it("allows blank nodes with backing url", () => {
            expect(() => {
                getBasicStore().processor.save(
                    rdfFactory.blankNode(),
                    { url: rdfFactory.namedNode("http://example.org/") },
                );
            }).not.toThrow("Can't resolve");
        });
    });

    describe("#queueDelta", () => {
        const resource = example.ns("1");

        it("sets the state", () => {
            const store = getBasicStore();
            store.processor.queueDelta([], [rdfFactory.id(resource)]);

            expect(store.store.getInternalStore().store.journal.get(resource.value).current)
                .toEqual(RecordState.Receiving);
        });
    });

    describe("#registerTransformer", () => {
        it("registers a transformer", () => {
            const store = getBasicStore();
            // @ts-ignore
            const mapping = store.processor.mapping;

            const transformer = (_res: ResponseAndFallbacks): Promise<Quadruple[]> => Promise.resolve([]);

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
