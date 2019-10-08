import "../../__tests__/useHashFactory";

import rdfFactory from "@ontologies/core";

import { IndexedFormula, RDFSerializer, Store } from "../../rdflib";
import { ChangeBuffer } from "../../types";

import { defaultNS as NS } from "../constants";
import { patchRDFLibSerializer, patchRDFLibStoreWithOverrides } from "../monkeys";

function serializeString(str: string, patch = true): string {
    const g = new IndexedFormula();
    g.add(rdfFactory.quad(NS.ex("1"), NS.ex("prop"), rdfFactory.literal(str)));

    const s = new RDFSerializer(new IndexedFormula());
    if (patch) {
        patchRDFLibSerializer(s, "deinprstux");
    }
    s.setFlags("deinprstux");

    return s.statementsToNTriples(g.statements);
}

function getStorePair(): [Store, ChangeBuffer] {
    const g = new IndexedFormula();

    const changeBuffer = {
        changeBuffer: [],
        changeBufferCount: 0,
    };

    return [g, changeBuffer];
}

describe("monkeys", () => {
    describe("patchRDFLibSerializer", () => {
        const prefix = "<http://example.com/ns#1> <http://example.com/ns#prop> ";
        const failing = "testtesttest\n\ntesttesttest";
        const succeeding = "test\n\ntest";

        it("patches the rdflib bug", () => {
            expect(serializeString(failing))
                .toEqual(`${prefix}"testtesttest\\n\\ntesttesttest"^^<http://www.w3.org/2001/XMLSchema#string> .\n`);
        });

        it("keeps normal strings in tact", () => {
            expect(serializeString(succeeding))
                .toEqual(`${prefix}"test\\n\\ntest"^^<http://www.w3.org/2001/XMLSchema#string> .\n`);
        });

        it("is still required", () => {
            expect(serializeString(failing, false))
                .toContain("\"\"\"");
        });
    });

    describe("patchRDFLibStoreWithOverrides", () => {
        it("returns the graph", () => {
            const [ g, changeBuffer ] = getStorePair();

            expect(patchRDFLibStoreWithOverrides(g, changeBuffer))
                .toEqual(g);
        });

        it("increments the changebuffer", () => {
            const [ g, changeBuffer ] = getStorePair();
            patchRDFLibStoreWithOverrides(g, changeBuffer);
            g.statements.push(rdfFactory.quad(NS.ex("1"), NS.ex("p"), NS.ex("2")));

            expect(changeBuffer.changeBufferCount).toEqual(1);
        });

        /** This verifies whether we use a memoization-enabled store */
        it("normalizes terms", () => {
            const [ g, changeBuffer ] = getStorePair();
            patchRDFLibStoreWithOverrides(g, changeBuffer);
            g.add([
                rdfFactory.quad(
                    rdfFactory.namedNode("http://example.com/1"),
                    rdfFactory.namedNode("http://example.com/p"),
                    rdfFactory.namedNode("http://example.com/2"),
                ),
                rdfFactory.quad(
                    rdfFactory.namedNode("http://example.com/3"),
                    rdfFactory.namedNode("http://example.com/p"),
                    rdfFactory.namedNode("http://example.com/4"),
                ),
            ]);

            expect(g.statements[0].subject).toHaveProperty("id");
        });
    });
});
