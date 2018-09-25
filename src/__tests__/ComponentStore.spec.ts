import "jest";

import { ComponentStore } from "../ComponentStore";
import { defaultNS as NS } from "../utilities/constants";
import { DEFAULT_TOPOLOGY, RENDER_CLASS_NAME } from "../utilities/constants";

const DT = DEFAULT_TOPOLOGY;
const RCN = RENDER_CLASS_NAME;

describe("ComponentStore", () => {
    describe("registerRenderer", () => {
        it("fails without component", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    undefined,
                    [NS.schema("Thing")],
                    [RCN],
                    [DT],
                );
            }).toThrowError();
        });

        it("registers with full notation", () => {
            const comp = (): string => "a";
            const reg = ComponentStore.registerRenderer(
                comp,
                [NS.schema("Thing")],
                [RCN],
                [DT],
            );

            expect(reg).toEqual([{
                component: comp,
                property: RCN,
                topology: DT,
                type: NS.schema("Thing"),
            }]);
        });

        it ("checks types for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [NS.schema("Thing"), undefined!],
                    [RCN],
                    [DT],
                );
            }).toThrowError(TypeError);
        });

        it ("checks properties for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [NS.schema("Thing")],
                    [RCN, undefined!],
                    [DT],
                );
            }).toThrowError(TypeError);
        });

        it ("checks topologies for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [NS.schema("Thing")],
                    [RCN],
                    [DT, undefined!],
                );
            }).toThrowError(TypeError);
        });
    });
});
