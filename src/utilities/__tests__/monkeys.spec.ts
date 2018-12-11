import {
    IndexedFormula,
    Literal,
    NamedNode,
    Serializer,
    Statement,
} from "rdflib";
import { ChangeBuffer } from "../../types";

import { defaultNS as NS } from "../constants";
import { patchRDFLibSerializer, patchRDFLibStoreWithOverrides, patchRDFLibStoreWithProxy } from "../monkeys";

function serializeString(str: string, patch = true): string {
    const g = new IndexedFormula();
    g.add(new Statement(NS.ex("1"), NS.ex("prop"), new Literal(str)));

    const s = new Serializer(new IndexedFormula());
    if (patch) {
        patchRDFLibSerializer(s, "deinprstux");
    }
    s.setFlags("deinprstux");

    return s.statementsToNTriples(g.statements);
}

function getStorePair(): [IndexedFormula, ChangeBuffer] {
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
                .toEqual(`${prefix}"testtesttest\\n\\ntesttesttest" .\n`);
        });

        it("keeps normal strings in tact", () => {
            expect(serializeString(succeeding))
                .toEqual(`${prefix}"test\\n\\ntest" .\n`);
        });

        it("is still required", () => {
            expect(serializeString(failing, false))
                .toContain("\"\"\"");
        });
    });

    describe("patchRDFLibStoreWithProxy", () => {
        it("returns the graph", () => {
            const [ g, changeBuffer ] = getStorePair();

            expect(patchRDFLibStoreWithProxy(g, changeBuffer))
                .toEqual(g);
        });

        it("increments the changebuffer", () => {
            const [ g, changeBuffer ] = getStorePair();
            patchRDFLibStoreWithProxy(g, changeBuffer);
            g.statements.push(new Statement(NS.ex("1"), NS.ex("p"), NS.ex("2")));

            expect(changeBuffer.changeBufferCount).toEqual(1);
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
            g.statements.push(new Statement(NS.ex("1"), NS.ex("p"), NS.ex("2")));

            expect(changeBuffer.changeBufferCount).toEqual(1);
        });

        it("normalizes terms", () => {
            const [ g, changeBuffer ] = getStorePair();
            patchRDFLibStoreWithOverrides(g, changeBuffer);
            g.add([
                new Statement(
                    new NamedNode("http://example.com/1"),
                    new NamedNode("http://example.com/p"),
                    new NamedNode("http://example.com/2"),
                ),
                new Statement(
                    new NamedNode("http://example.com/3"),
                    new NamedNode("http://example.com/p"),
                    new NamedNode("http://example.com/4"),
                ),
            ]);

            expect(g.statements[0].subject).toHaveProperty("sI");
        });
    });
});
