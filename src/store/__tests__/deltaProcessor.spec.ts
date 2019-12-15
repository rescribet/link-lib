import "../../__tests__/useHashFactory";

import rdfFactory, { LowLevelStore, NamedNode, Quadruple } from "@ontologies/core";
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

    const testDelta = (delta: Quadruple[], [adds, replaces, removes]: [number, number, number]): void => {
        const store = filledStore();
        const processor = defaultProcessor(store);

        const [ addable, replaceable, removable ] = processor(delta);

        expect(addable).toHaveLength(adds);
        expect(replaceable).toHaveLength(replaces);
        expect(removable).toHaveLength(removes);
        expect((store as any).quads).toHaveLength(initialCount);
    };

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
            testDelta([ [bob, schema.children, alice, ld.add] ], [1, 0, 0]);
        });

        it("replace", () => {
            testDelta([ [bob, schema.children, alice, ld.replace] ], [0, 1, 0]);
        });

        it("remove", () => {
            testDelta([ [bob, schema.children, alice, ld.remove] ], [0, 0, 3]);
        });

        it("purge", () => {
            testDelta([ [bob, schema.children, alice, ld.purge] ], [0, 0, 5]);
        });

        it("slice", () => {
            testDelta([ [bob, schema.children, alice, ld.slice] ], [0, 0, 1]);
        });
    });

    describe("with a new value", () => {
        it("add", () => {
            testDelta([ [bob, schema.children, erin, ld.add] ], [1, 0, 0]);
        });

        it("replace", () => {
            testDelta([ [bob, schema.children, erin, ld.replace] ], [0, 1, 0]);
        });

        it("remove", () => {
            testDelta([ [bob, schema.children, erin, ld.remove] ], [0, 0, 3]);
        });

        it("purge", () => {
            testDelta([ [bob, schema.children, erin, ld.purge] ], [0, 0, 5]);
        });

        it("slice", () => {
            testDelta([ [bob, schema.children, erin, ld.slice] ], [0, 0, 0]);
        });
    });

    describe("with graph", () => {
        const graphify = (iri: NamedNode): NamedNode =>
            rdfFactory.namedNode(iri.value + `?graph=${encodeURIComponent(graph)}`);

        it("add", () => {
            testDelta([ [bob, schema.children, erin, graphify(ld.add)] ], [1, 0, 0]);
        });

        it("replace", () => {
            testDelta([ [bob, schema.children, erin, graphify(ld.replace)] ], [0, 1, 0]);
        });

        it("remove", () => {
            testDelta([ [bob, schema.children, erin, graphify(ld.remove)] ], [0, 0, 3]);
        });

        it("purge", () => {
            testDelta([ [bob, schema.children, erin, graphify(ld.purge)] ], [0, 0, 5]);
        });

        it("slice", () => {
            testDelta([ [bob, schema.children, erin, graphify(ld.slice)] ], [0, 0, 0]);
        });
    });
});
