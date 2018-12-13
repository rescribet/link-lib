import {
    IndexedFormula,
    Literal,
    Serializer,
    Statement,
} from "rdflib";

import { defaultNS as NS } from "../constants";
import { patchRDFLibSerializer } from "../monkeys";

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
                .toContain('"""');
        });
    });
});
