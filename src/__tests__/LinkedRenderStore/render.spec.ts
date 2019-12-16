import rdfFactory from "@ontologies/core";
import rdfs from "@ontologies/rdfs";
import schema from "@ontologies/schema";

import { LinkedRenderStore } from "../../LinkedRenderStore";
import { getBasicStore } from "../../testUtilities";

import { DT, RCN } from "./fixtures";

describe("LinkedRenderStore", () => {
    describe("type renderer", () => {
        it("registers with full notation", () => {
            const store = getBasicStore();
            const comp = (): string => "a";
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(comp, schema.Thing));
            const thingComp = store.mapping.getRenderComponent(
                [rdfFactory.id(schema.Thing)],
                [RCN],
                DT,
                rdfFactory.id(rdfs.Resource),
            );
            expect(thingComp).toEqual(comp);
        });

        it("registers with multiple types", () => {
            const store = getBasicStore();
            const comp = (): string => "a";
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(
                comp,
                [schema.Thing, schema.CreativeWork],
            ));
            const thingComp = store.mapping.getRenderComponent(
                [rdfFactory.id(schema.Thing)],
                [RCN],
                DT,
                rdfFactory.id(rdfs.Resource),
            );
            expect(thingComp).toEqual(comp);
            const cwComp = store.mapping.getRenderComponent(
                [rdfFactory.id(schema.CreativeWork)],
                [RCN],
                DT,
                rdfFactory.id(rdfs.Resource),
            );
            expect(cwComp).toEqual(comp);
        });
    });

    describe("property renderer", () => {
        it("registers with full notation", () => {
            const store = getBasicStore();
            const ident = (): string => "a";
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(ident, schema.Thing, schema.name));
            const nameComp = store.mapping.getRenderComponent(
                [rdfFactory.id(schema.Thing)],
                [rdfFactory.id(schema.name)],
                DT,
                rdfFactory.id(rdfs.Resource),
            );
            expect(nameComp).toEqual(ident);
        });

        it("registers multiple", () => {
            const store = getBasicStore();
            const ident = (): string => "a";
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(
                ident,
                schema.Thing,
                [schema.name, rdfs.label],
            ));
            [schema.name, rdfs.label].forEach((prop) => {
                const nameComp = store.mapping.getRenderComponent(
                    [rdfFactory.id(schema.Thing)],
                    [rdfFactory.id(prop)],
                    DT,
                    rdfFactory.id(rdfs.Resource),
                );
                expect(nameComp).toEqual(ident);
                expect(nameComp).not.toEqual((): string => "b");
            });
        });
    });

    describe("returns renderer for", () => {
        it("class renders", () => {
            const LRS = new LinkedRenderStore();
            expect(LRS.getComponentForType(schema.Thing)).toBeUndefined();
            const ident = (a: string): string => a;
            const registrations = LinkedRenderStore.registerRenderer(ident, schema.Thing);
            LRS.registerAll(registrations);
            const klass = LRS.getComponentForType(schema.Thing);
            expect(klass).toEqual(ident);
            expect(klass).not.toEqual((a: string): string => a);
        });

        it("property renders", () => {
            const LRS = new LinkedRenderStore();
            const ident = (a: string): string => a;
            const registrations = LinkedRenderStore.registerRenderer(
                ident,
                schema.Thing,
                schema.name,
            );
            LRS.registerAll(registrations);
            const klass = LRS.getComponentForProperty(schema.Thing, schema.name);
            expect(klass).toEqual(ident);
            expect(klass).not.toEqual((a: string): string => a);
        });
    });
});
