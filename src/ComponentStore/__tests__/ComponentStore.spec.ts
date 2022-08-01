import "jest";
import "../../__tests__/useFactory";

import rdfFactory from "@ontologies/core";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";

import { RDFStore } from "../../RDFStore";
import { Schema } from "../../Schema";
import { getBasicStore } from "../../testUtilities";
import { DEFAULT_TOPOLOGY, RENDER_CLASS_NAME } from "../../utilities/constants";
import { ComponentStore } from "../ComponentStore";

const DT = rdfFactory.id(DEFAULT_TOPOLOGY);
const RCN = rdfFactory.id(RENDER_CLASS_NAME);

describe("ComponentStore", () => {
    describe("registerRenderer", () => {
        it("fails without component", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    undefined,
                    [schema.Thing.value],
                    [RCN],
                    [DT],
                );
            }).toThrowError();
        });

        it("registers with full notation", () => {
            const comp = (): string => "a";
            const reg = ComponentStore.registerRenderer(
                comp,
                [schema.Thing.value],
                [RCN],
                [DT],
            );

            expect(reg).toEqual([{
                component: comp,
                property: RCN,
                topology: DT,
                type: schema.Thing.value,
            }]);
        });

        it ("checks types for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [schema.Thing.value, undefined!],
                    [RCN],
                    [DT],
                );
            }).toThrowError(TypeError);
        });

        it ("checks properties for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [schema.Thing.value],
                    [RCN, undefined!],
                    [DT],
                );
            }).toThrowError(TypeError);
        });

        it ("checks topologies for undefined values", () => {
            expect(() => {
                ComponentStore.registerRenderer(
                    () => undefined,
                    [schema.Thing.value],
                    [RCN],
                    [DT, undefined!],
                );
            }).toThrowError(TypeError);
        });

        it ("returns undefined when no property is given", () => {
            const store = getBasicStore();

            expect(store.mapping.registerRenderer(
                () => undefined,
                schema.Thing.value,
                undefined,
                undefined,
            )).toBeUndefined();
        });
    });

    describe("getRenderComponent", () => {
        it("resolved with unregistered views", () => {
            const store = new ComponentStore(new Schema(new RDFStore()));
            const unregistered = schema.url.value;
            const registered = schema.name.value;

            const comp = (): string => "test";
            store.registerRenderer(comp, schema.BlogPosting.value, registered);

            const lookup = store.getRenderComponent(
                [schema.BlogPosting.value],
                [unregistered, registered],
                DEFAULT_TOPOLOGY.value,
                rdfs.Resource.value,
            );

            expect(lookup).toEqual(comp);
        });
    });
});
