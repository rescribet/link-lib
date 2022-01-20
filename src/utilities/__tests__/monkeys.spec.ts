import "../../__tests__/useHashFactory";

import rdfFactory, { QuadPosition } from "@ontologies/core";

import ex from "../../ontology/ex";
import { RDFAdapter } from "../../store/RDFAdapter";
import RDFIndex from "../../store/RDFIndex";
import { ChangeBuffer } from "../../types";

import { addChangeBufferCallbacks } from "../monkeys";

function getStorePair(): [RDFAdapter, ChangeBuffer] {
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

            expect(addChangeBufferCallbacks(g, changeBuffer))
                .toEqual(g);
        });

        it("increments the changebuffer", () => {
            const [ g, changeBuffer ] = getStorePair();
            addChangeBufferCallbacks(g, changeBuffer);
            g.add(ex.ns("1"), ex.ns("p"), ex.ns("2"));

            expect(changeBuffer.changeBufferCount).toEqual(1);
        });

        /** This verifies whether we use a memoization-enabled store */
        it("normalizes terms", () => {
            const [ g, changeBuffer ] = getStorePair();
            addChangeBufferCallbacks(g, changeBuffer);
            g.add(
              rdfFactory.namedNode("http://example.com/1"),
              rdfFactory.namedNode("http://example.com/p"),
              rdfFactory.namedNode("http://example.com/2"),
            );
            g.add(
              rdfFactory.namedNode("http://example.com/3"),
              rdfFactory.namedNode("http://example.com/p"),
              rdfFactory.namedNode("http://example.com/4"),
            );

            expect((g as any).quads[0][QuadPosition.subject]).toHaveProperty("id");
        });
    });
});
