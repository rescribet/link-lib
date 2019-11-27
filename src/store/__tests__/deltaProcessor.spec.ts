import "../../__tests__/useHashFactory";

import rdfFactory, { LowLevelStore, NamedNode } from "@ontologies/core";
import ld from "@ontologies/ld";
import rdf from "@ontologies/rdf";
import schema from "@ontologies/schema";
import "jest";

import { defaultNS as NS } from "../../utilities/constants";
import { deltaProcessor } from "../deltaProcessor";
import RDFIndex from "../RDFIndex";

describe("deltaProcessor", () => {
    const graph = rdfFactory.namedNode("http://example.com/graph");

    const alice = NS.ex("person/alice");
    const bob = NS.ex("person/bob");
    const erin = NS.ex("person/erin");

    const defaultProcessor = deltaProcessor(
        [ld.add],
        [
            rdfFactory.defaultGraph(),
            ld.replace,
            rdfFactory.namedNode("chrome:theSession"),
        ],
        [ld.remove],
        [ld.purge],
        [ld.slice],
    );
    const filledStore = (): LowLevelStore => {
        const store = new RDFIndex();

        store.add(bob, rdf.type, schema.Person);
        store.add(bob, schema.name, rdfFactory.literal("bob"));
        store.add(bob, schema.children, alice);
        store.add(bob, schema.children, NS.ex("person/charlie"));
        store.add(bob, schema.children, NS.ex("person/dave"));

        store.add(alice, rdf.type, schema.Person);
        store.add(alice, schema.name, rdfFactory.literal("Alice"));

        store.add(bob, rdf.type, schema.Person, graph);
        store.add(bob, schema.name, rdfFactory.literal("bob"), graph);
        store.add(bob, schema.children, alice, graph);
        store.add(bob, schema.children, NS.ex("person/charlie"), graph);
        store.add(bob, schema.children, NS.ex("person/dave"), graph);

        store.add(alice, rdf.type, schema.Person, graph);
        store.add(alice, schema.name, rdfFactory.literal("Alice"), graph);

        return store;
    };
    const initialCount = 14;

    it("handles empty values", () => {
        const store = filledStore();
        const processor = defaultProcessor(store);

        const [ addable, replaceable, removable ] = processor(new Array(1));
        expect(addable).toEqual([]);
        expect(replaceable).toEqual([]);
        expect(removable).toEqual([]);
        expect((store as any).quads).toHaveLength(initialCount);
    });

    describe("with an existing value", () => {
        it("add", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, ld.add],
            ]);

            expect(addable).toHaveLength(1);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(0);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("replace", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, ld.replace],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(1);
            expect(removable).toHaveLength(0);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("remove", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, ld.remove],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(3);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("purge", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, ld.purge],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(5);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("slice", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, alice, ld.slice],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(1);
            expect((store as any).quads).toHaveLength(initialCount);
        });
    });

    describe("with a new value", () => {
        it("add", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, ld.add],
            ]);

            expect(addable).toHaveLength(1);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(0);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("replace", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, ld.replace],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(1);
            expect(removable).toHaveLength(0);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("remove", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, ld.remove],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(3);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("purge", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, ld.purge],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(5);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("slice", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, ld.slice],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(0);
            expect((store as any).quads).toHaveLength(initialCount);
        });
    });

    describe("with graph", () => {
        const graphify = (iri: NamedNode): NamedNode =>
            rdfFactory.namedNode(iri.value + `?graph=${encodeURIComponent(graph)}`);

        it("add", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, graphify(ld.add)],
            ]);

            expect(addable).toHaveLength(1);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(0);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("replace", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, graphify(ld.replace)],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(1);
            expect(removable).toHaveLength(0);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("remove", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, graphify(ld.remove)],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(3);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("purge", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, graphify(ld.purge)],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(5);
            expect((store as any).quads).toHaveLength(initialCount);
        });

        it("slice", () => {
            const store = filledStore();
            const processor = defaultProcessor(store);

            const [ addable, replaceable, removable ] = processor([
                [bob, schema.children, erin, graphify(ld.slice)],
            ]);

            expect(addable).toHaveLength(0);
            expect(replaceable).toHaveLength(0);
            expect(removable).toHaveLength(0);
            expect((store as any).quads).toHaveLength(initialCount);
        });
    });
});
