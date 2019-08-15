import "jest";
import {
    IndexedFormula, Literal,
    NamedNode,
} from "rdflib";

import { defaultNS as NS } from "../../utilities/constants";
import { deltaProcessor } from "../deltaProcessor";

describe("deltaProcessor", () => {
    const alice = NS.ex("person/alice");
    const bob = NS.ex("person/bob");
    const erin = NS.ex("person/erin");

    const defaultProcessor = deltaProcessor(
        [NS.ll("add")],
        [
            undefined,
            NS.ll("replace"),
            new NamedNode("chrome:theSession"),
        ],
        [NS.ll("remove")],
        [NS.ll("purge")],
        [NS.ll("slice")],
    );
    const filledStore = (): IndexedFormula => {
        const store = new IndexedFormula();

        store.add(bob, NS.rdf.type, NS.schema.Person);
        store.add(bob, NS.schema.name, new Literal("bob"));
        store.add(bob, NS.schema.children, alice);
        store.add(bob, NS.schema.children, NS.ex("person/charlie"));
        store.add(bob, NS.schema.children, NS.ex("person/dave"));

        store.add(alice, NS.rdf.type, NS.schema.Person);
        store.add(alice, NS.schema.name, new Literal("Alice"));

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
                [bob, NS.schema.children, alice, NS.ll("add")],
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
                [bob, NS.schema.children, alice, NS.ll("replace")],
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
                [bob, NS.schema.children, alice, NS.ll("remove")],
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
                [bob, NS.schema.children, alice, NS.ll("purge")],
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
                [bob, NS.schema.children, alice, NS.ll("slice")],
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
                [bob, NS.schema.children, erin, NS.ll("add")],
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
                [bob, NS.schema.children, erin, NS.ll("replace")],
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
                [bob, NS.schema.children, erin, NS.ll("remove")],
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
                [bob, NS.schema.children, erin, NS.ll("purge")],
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
                [bob, NS.schema.children, erin, NS.ll("slice")],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(0);
            expect(store).toHaveLength(initialCount);
        });
    });
});
