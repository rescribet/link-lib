import "../../__tests__/useHashFactory";

import rdfFactory from "@ontologies/core";
import rdf from "@ontologies/rdf";
import schema from "@ontologies/schema";
import "jest";

import { IndexedFormula, Store } from "../../rdflib";
import { defaultNS as NS } from "../../utilities/constants";
import { deltaProcessor } from "../deltaProcessor";

describe("deltaProcessor", () => {
    const alice = NS.ex("person/alice");
    const bob = NS.ex("person/bob");
    const erin = NS.ex("person/erin");

    const defaultProcessor = deltaProcessor(
        [NS.ld("add")],
        [
            undefined,
            NS.ld("replace"),
            rdfFactory.namedNode("chrome:theSession"),
        ],
        [NS.ld("remove")],
        [NS.ld("purge")],
        [NS.ld("slice")],
    );
    const filledStore = (): Store => {
        const store = new IndexedFormula();

        store.add(bob, rdf.type, schema.Person);
        store.add(bob, schema.name, rdfFactory.literal("bob"));
        store.add(bob, schema.children, alice);
        store.add(bob, schema.children, NS.ex("person/charlie"));
        store.add(bob, schema.children, NS.ex("person/dave"));

        store.add(alice, rdf.type, schema.Person);
        store.add(alice, schema.name, rdfFactory.literal("Alice"));

        return store;
    };
    const initialCount = 7;

    it("handles empty values", () => {
        const store = filledStore();
        const processor = defaultProcessor(store);

        const [ addable, replaceable, removable ] = processor(new Array(1));
        expect(addable).toEqual([]);
        expect(replaceable).toEqual([]);
        expect(removable).toEqual([]);
        expect(store).toHaveLength(initialCount);
    });

    describe("with an existing value", () => {
        it("add", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, NS.ld("add")],
            ]);

            expect(addable).toHaveLength(1);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(0);
            expect(store).toHaveLength(initialCount);
        });

        it("replace", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, NS.ld("replace")],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(1);
            expect(removable).toHaveLength(0);
            expect(store).toHaveLength(initialCount);
        });

        it("remove", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, NS.ld("remove")],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(3);
            expect(store).toHaveLength(initialCount);
        });

        it("purge", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, NS.ld("purge")],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(5);
            expect(store).toHaveLength(initialCount);
        });

        it("slice", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, NS.ld("slice")],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(1);
            expect(store).toHaveLength(initialCount);
        });
    });

    describe("with a new value", () => {
        it("add", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, NS.ld("add")],
            ]);

            expect(addable).toHaveLength(1);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(0);
            expect(store).toHaveLength(initialCount);
        });

        it("replace", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, NS.ld("replace")],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(1);
            expect(removable).toHaveLength(0);
            expect(store).toHaveLength(initialCount);
        });

        it("remove", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, NS.ld("remove")],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(3);
            expect(store).toHaveLength(initialCount);
        });

        it("purge", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, NS.ld("purge")],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(5);
            expect(store).toHaveLength(initialCount);
        });

        it("slice", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, NS.ld("slice")],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(0);
            expect(store).toHaveLength(initialCount);
        });
    });
});
