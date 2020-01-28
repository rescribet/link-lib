import "jest";
import "./useHashFactory";

import rdfs from "@ontologies/rdfs";
import schema from "@ontologies/schema";

import { ComponentStore } from "../ComponentStore";
import { RDFStore } from "../RDFStore";
import { Schema } from "../Schema";
import { getBasicStore } from "../testUtilities";
import { DEFAULT_TOPOLOGY, RENDER_CLASS_NAME } from "../utilities/constants";

const DT = DEFAULT_TOPOLOGY;
const RCN = RENDER_CLASS_NAME;

describe("ComponentStore", () => {
    describe("registerRenderer", () => {
        it("fails without component", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    undefined,
                    [schema.Thing],
                    [RCN],
                    [DT],
                );
            }).toThrowError();
        });

        it("registers with full notation", () => {
            const comp = (): string => "a";
            const reg = ComponentStore.registerRenderer(
                comp,
                [schema.Thing],
                [RCN],
                [DT],
            );

            expect(reg).toEqual([{
                component: comp,
                property: RCN,
                topology: DT,
                type: schema.Thing,
            }]);
        });

        it ("checks types for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [schema.Thing, undefined!],
                    [RCN],
                    [DT],
                );
            }).toThrowError(TypeError);
        });

        it ("checks properties for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [schema.Thing],
                    [RCN, undefined!],
                    [DT],
                );
            }).toThrowError(TypeError);
        });

        it ("checks topologies for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [schema.Thing],
                    [RCN],
                    [DT, undefined!],
                );
            }).toThrowError(TypeError);
        });

        it ("returns undefined when no property is given", () => {
            const store = getBasicStore();

            expect(store.mapping.registerRenderer(
                () => undefined,
                schema.Thing,
                undefined,
                undefined,
            )).toBeUndefined();
        });
    });

    describe("getRenderComponent", () => {
        it("resolved with unregistered views", () => {
            const store = new ComponentStore(new Schema(new RDFStore()));
            const unregistered = schema.url;
            const registered = schema.name;

            const comp = (): string => "test";
            store.registerRenderer(comp, schema.BlogPosting, registered);

            const lookup = store.getRenderComponent(
                [schema.BlogPosting],
                [unregistered, registered],
                DEFAULT_TOPOLOGY,
                rdfs.Resource,
            );

            expect(lookup).toEqual(comp);
        });
    });
});
