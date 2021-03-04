import "jest";
import "./useHashFactory";

import rdfFactory, { Quad } from "@ontologies/core";
import * as owl from "@ontologies/owl";
import * as rdf from "@ontologies/rdf";
import * as schema from "@ontologies/schema";
import { LinkedRenderStore } from "../LinkedRenderStore";

import { getBasicStore } from "../testUtilities";

import { example } from "./LinkedRenderStore/fixtures";

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
                    force: true,
                },
            );
        });
    });

    describe("reasons correctly", () => {
        it("combines sameAs declarations", async () => {
            const store = getBasicStore();

            const id = example("sameFirst");
            const idSecond = example("sameSecond");
            const testData = [
                rdfFactory.quad(id, rdf.type, schema.CreativeWork),
                rdfFactory.quad(id, schema.text, rdfFactory.literal("text")),
                rdfFactory.quad(id, schema.author, rdfFactory.namedNode("http://example.org/people/0")),

                rdfFactory.quad(idSecond, rdf.type, schema.CreativeWork),
                rdfFactory.quad(idSecond, schema.name, rdfFactory.literal("other")),

                rdfFactory.quad(idSecond, owl.sameAs, id),
            ];

            store.store.addQuads(testData);
            const entity = await store.lrs.tryEntity(id) as Quad[];

            expect(entity.map((s) => s.object.value)).toContainEqual("other");
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
