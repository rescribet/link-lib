import "../../__tests__/useFactory";

import rdfFactory, { Quadruple } from "@ontologies/core";
import * as ld from "@ontologies/ld";
import * as rdf from "@ontologies/rdf";
import * as schema from "@ontologies/schema";
import "jest";

import ex from "../../ontology/ex";
import { deltaProcessor } from "../deltaProcessor";
import { RDFAdapter } from "../RDFAdapter";

describe("deltaProcessor", () => {
    const alice = ex.ns("person/alice");
    const bob = ex.ns("person/bob");
    const erin = ex.ns("person/erin");

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

    const filledStore = (): RDFAdapter => {
        const store = new RDFAdapter();

        store.add(bob, rdf.type, schema.Person);
        store.add(bob, schema.name, rdfFactory.literal("bob"));
        store.add(bob, schema.children, alice);
        store.add(bob, schema.children, ex.ns("person/charlie"));
        store.add(bob, schema.children, ex.ns("person/dave"));

        store.add(alice, rdf.type, schema.Person);
        store.add(alice, schema.name, rdfFactory.literal("Alice"));

        return store;
    };
    const initialCount = 7;

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

    it("requires explicit graph names", () => {
        expect(() => {
            deltaProcessor([], [], [], [], []);
        }).toThrow("Pass a default graph explicitly");
    });

    it("ignores unknown methods", () => {
        testDelta([ [bob, schema.children, alice, ld.ns("unknown")] ], [0, 0, 0]);
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
});
