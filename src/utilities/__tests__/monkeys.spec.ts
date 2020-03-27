import "../../__tests__/useHashFactory";

import rdfFactory, { LowLevelStore } from "@ontologies/core";

import ex from "../../ontology/ex";
import RDFIndex from "../../store/RDFIndex";
import { ChangeBuffer } from "../../types";

import { patchRDFLibStoreWithOverrides } from "../monkeys";

function getStorePair(): [LowLevelStore, ChangeBuffer] {
    const g = new RDFIndex();

    const changeBuffer = {
        changeBuffer: [],
        changeBufferCount: 0,
    };

    return [g, changeBuffer];
}

describe("monkeys", () => {
    describe("patchRDFLibStoreWithOverrides", () => {
        it("returns the graph", () => {
            const [ g, changeBuffer ] = getStorePair();

            expect(patchRDFLibStoreWithOverrides(g, changeBuffer))
                .toEqual(g);
        });

        it("increments the changebuffer", () => {
            const [ g, changeBuffer ] = getStorePair();
            patchRDFLibStoreWithOverrides(g, changeBuffer);
            g.addQuad(rdfFactory.quad(ex.ns("1"), ex.ns("p"), ex.ns("2")));

            expect(changeBuffer.changeBufferCount).toEqual(1);
        });

        /** This verifies whether we use a memoization-enabled store */
        it("normalizes terms", () => {
            const [ g, changeBuffer ] = getStorePair();
            patchRDFLibStoreWithOverrides(g, changeBuffer);
            g.addQuads([
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

            expect((g as any).quads[0].subject).toHaveProperty("id");
        });
    });
});
