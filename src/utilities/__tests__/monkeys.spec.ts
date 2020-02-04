import "../../__tests__/useHashFactory";

import rdfFactory, { LowLevelStore } from "@ontologies/core";
import RDFIndex from "../../store/RDFIndex";

import { ChangeBuffer } from "../../types";

import { defaultNS as NS } from "../constants";
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
            g.addHex(rdfFactory.quad(NS.ex("1"), NS.ex("p"), NS.ex("2")));

            expect(changeBuffer.changeBufferCount).toEqual(1);
        });
    });
});
