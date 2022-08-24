import "jest";
import "./useFactory";

import rdfFactory, { QuadPosition, Quadruple } from "@ontologies/core";
import * as owl from "@ontologies/owl";
import * as rdf from "@ontologies/rdf";
import * as schema from "@ontologies/schema";
import { LinkedRenderStore } from "../LinkedRenderStore";

import { getBasicStore } from "../testUtilities";

import { example } from "./LinkedRenderStore/fixtures";

const defaultGraph = rdfFactory.defaultGraph();

describe("LinkedRenderStore", () => {
    describe("actions", () => {
        it("allows overriding dispach", () => {
            const dispatch = jest.fn();
            const lrs = new LinkedRenderStore({
                dispatch,
            });

            expect(lrs.dispatch).toStrictEqual(dispatch);
        });

        it ("prevents premature executions", () => {
            const lrs = new LinkedRenderStore();

            expect(lrs.exec(rdf.type)).rejects.toBeInstanceOf(Error);
        });
    });

    describe("data fetching", () => {
        it("allows data reload", async () => {
            const apiGetEntity = jest.fn();
            const iri = rdf.type;
            // @ts-ignore
            const store = getBasicStore({ api: { getEntity: apiGetEntity } });

            await store.lrs.getEntity(iri, { reload: true });

            expect(apiGetEntity).toHaveBeenCalledWith(
                iri,
                {
                    clearPreviousData: true,
                },
            );
        });
    });

    describe("reasons correctly", () => {
        it("combines sameAs declarations", async () => {
            const store = getBasicStore();

            const id = example("sameFirst");
            const idSecond = example("sameSecond");
            const testData: Quadruple[] = [
                [id, rdf.type, schema.CreativeWork, defaultGraph],
                [id, schema.text, rdfFactory.literal("text"), defaultGraph],
                [id, schema.author, rdfFactory.namedNode("http://example.org/people/0"), defaultGraph],

                [idSecond, rdf.type, schema.CreativeWork, defaultGraph],
                [idSecond, schema.name, rdfFactory.literal("other"), defaultGraph],

                [idSecond, owl.sameAs, id, defaultGraph],
            ];

            store.store.addQuads(testData);
            const record = store.lrs.getRecord(idSecond)!;

            expect(record[schema.author.value]).toEqual(rdfFactory.namedNode("http://example.org/people/0"));
        });
    });

    describe("#reset", () => {
        const store = getBasicStore();
        store.lrs.reset();
        const openStore = store.lrs as any;

        it("reinitialized the store", () => expect(openStore.store).not.toStrictEqual(store.store));
        it("reinitialized the schema", () => expect(openStore.schema === store.schema).toBeFalsy());
        it("reinitialized the mapping", () => expect(openStore.mapping === store.mapping).toBeFalsy());
    });
});
