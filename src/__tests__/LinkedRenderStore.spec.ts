import "jest";
import "./useHashFactory";

import rdfFactory, { HexPos } from "@ontologies/core";
import owl from "@ontologies/owl";
import rdf from "@ontologies/rdf";
import schema from "@ontologies/schema";

import { getBasicStore } from "../testUtilities";

import { example } from "./LinkedRenderStore/fixtures";

describe("LinkedRenderStore", () => {
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

            store.store.addHextuples(testData);
            const entity = await store.lrs.tryEntity(id);

            expect(entity.map((s) => s[HexPos.object])).toContainEqual("other");
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
