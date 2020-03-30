import rdfFactory, { Quadruple } from "@ontologies/core";

import { getBasicStore } from "../../testUtilities";
import { DeltaProcessor } from "../../types";

import { ex, ld } from "./fixtures";

describe("LinkedRenderStore", () => {
    describe("#addDeltaProcessor", () => {
        it ("adds the processor", () => {
            const processor = jest.fn();
            const { lrs } = getBasicStore();

            lrs.addDeltaProcessor(processor as unknown as DeltaProcessor);
            expect(lrs.deltaProcessors).toContain(processor);
        });
    });

    describe("#queueDelta", () => {
        const quadDelta = [
            [ex("1"), ex("p"), ex("2"), ld.add],
            [ex("1"), ex("t"), rdfFactory.literal("Test"), ld.add],
            [ex("2"), ex("t"), rdfFactory.literal("Value"), ld.add],
        ] as Quadruple[];

        it("queues an empty delta", async () => {
            const store = getBasicStore();

            await store.lrs.queueDelta([]);
        });

        it("queues a quadruple delta", async () => {
            const processor = {
                flush: jest.fn(),
                processDelta: jest.fn(),
                queueDelta: jest.fn(),
            };
            const store = getBasicStore();
            store.lrs.deltaProcessors.push(processor);

            await store.lrs.queueDelta(quadDelta);

            expect(processor.queueDelta).toHaveBeenCalledTimes(1);
            expect(processor.queueDelta).toHaveBeenCalledWith(
                quadDelta,
                [rdfFactory.id(ex("1")), rdfFactory.id(ex("2"))],
            );
        });

        it("queues a statement delta", async () => {
            const processor = {
                flush: jest.fn(),
                processDelta: jest.fn(),
                queueDelta: jest.fn(),
            };
            const store = getBasicStore();
            store.lrs.deltaProcessors.push(processor);

            const delta = [
                rdfFactory.quad(ex("1"), ex("p"), ex("2"), ld.add),
                rdfFactory.quad(ex("1"), ex("t"), rdfFactory.literal("Test"), ld.add),
                rdfFactory.quad(ex("2"), ex("t"), rdfFactory.literal("Value"), ld.add),
            ];
            await store.lrs.queueDelta(delta);

            expect(processor.queueDelta).toHaveBeenCalledTimes(1);
            expect(processor.queueDelta).toHaveBeenCalledWith(
                quadDelta,
                [rdfFactory.id(ex("1")), rdfFactory.id(ex("2"))],
            );
        });
    });
});
