import "jest";

import { ComponentStore } from "../ComponentStore";
import { getBasicStore } from "../testUtilities";
import { defaultNS as NS } from "../utilities/constants";
import { DEFAULT_TOPOLOGY, RENDER_CLASS_NAME } from "../utilities/constants";

const DT = DEFAULT_TOPOLOGY.sI;
const RCN = RENDER_CLASS_NAME.sI;

describe("ComponentStore", () => {
    describe("registerRenderer", () => {
        it("fails without component", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    undefined,
                    [NS.schema("Thing").sI],
                    [RCN],
                    [DT],
                );
            }).toThrowError();
        });

        it("registers with full notation", () => {
            const comp = (): string => "a";
            const reg = ComponentStore.registerRenderer(
                comp,
                [NS.schema("Thing").sI],
                [RCN],
                [DT],
            );

            expect(reg).toEqual([{
                component: comp,
                property: RCN,
                topology: DT,
                type: NS.schema("Thing").sI,
            }]);
        });

        it ("checks types for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [NS.schema("Thing").sI, undefined!],
                    [RCN],
                    [DT],
                );
            }).toThrowError(TypeError);
        });

        it ("checks properties for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [NS.schema("Thing").sI],
                    [RCN, undefined!],
                    [DT],
                );
            }).toThrowError(TypeError);
        });

        it ("checks topologies for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [NS.schema("Thing").sI],
                    [RCN],
                    [DT, undefined!],
                );
            }).toThrowError(TypeError);
        });

        it ("returns undefined when no property is given", () => {
            const store = getBasicStore();

            expect(store.mapping.registerRenderer(
                () => undefined,
                NS.schema("Thing").sI,
                undefined,
                undefined,
            )).toBeUndefined();
        });
    });
});
