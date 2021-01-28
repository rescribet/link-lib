import rdfFactory, { NamedNode } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as schema from "@ontologies/schema";

import { RENDER_CLASS_NAME } from "../../ComponentStore";
import { LinkedRenderStore } from "../../LinkedRenderStore";
import argu from "../../ontology/argu";
import { getBasicStore } from "../../testUtilities";
import { ComponentRegistration, SomeNode } from "../../types";
import { DEFAULT_TOPOLOGY } from "../../utilities/constants";

import { DT, example, RCN } from "./fixtures";

describe("LinkedRenderStore", () => {
    describe("::registerRenderer", () => {
        const func = (): void => undefined;
        const type = schema.Thing;
        const types = [schema.Thing, schema.Person];
        const prop = schema.name;
        const props = [schema.name, schema.text, schema.dateCreated];
        const topology = argu.ns("collection");
        const topologies = [argu.ns("collection"), argu.ns("collection")];

        function checkRegistration<T>(r: ComponentRegistration<T>,
                                      c: T,
                                      t: SomeNode,
                                      p: NamedNode,
                                      top: SomeNode): void {
            expect(r.component).toEqual(c);
            expect(r.type).toEqual(rdfFactory.id(t));
            expect(r.property).toEqual(rdfFactory.id(p));
            expect(r.topology).toEqual(rdfFactory.id(top));
        }

        it("does not register without component", () => {
            const defaultMsg = `Undefined component was given for (${rdfFactory.id(type)}, ${RCN}, ${DT}).`;
            try {
                LinkedRenderStore.registerRenderer(undefined, type);
                expect(true).toBeFalsy();
            } catch (e) {
                expect(e.message).toEqual(defaultMsg);
            }
        });

        it("registers function type", () => {
            const r = LinkedRenderStore.registerRenderer(func, type);
            expect(r.length).toEqual(1);
            checkRegistration(r[0], func, type, RENDER_CLASS_NAME, DEFAULT_TOPOLOGY);
        });

        it("registers multiple types", () => {
            const r = LinkedRenderStore.registerRenderer(func, types);
            expect(r.length).toEqual(2);
            checkRegistration(r[0], func, types[0], RENDER_CLASS_NAME, DEFAULT_TOPOLOGY);
            checkRegistration(r[1], func, types[1], RENDER_CLASS_NAME, DEFAULT_TOPOLOGY);
        });

        it("registers a prop", () => {
            const r = LinkedRenderStore.registerRenderer(func, type, prop);
            expect(r.length).toEqual(1);
            checkRegistration(r[0], func, type, prop, DEFAULT_TOPOLOGY);
        });

        it("registers mutliple props", () => {
            const r = LinkedRenderStore.registerRenderer(func, type, props);
            expect(r.length).toEqual(3);
            checkRegistration(r[0], func, type, props[0], DEFAULT_TOPOLOGY);
            checkRegistration(r[1], func, type, props[1], DEFAULT_TOPOLOGY);
            checkRegistration(r[2], func, type, props[2], DEFAULT_TOPOLOGY);
        });

        it("registers a topology", () => {
            const r = LinkedRenderStore.registerRenderer(func, type, prop, topology);
            expect(r.length).toEqual(1);
            checkRegistration(r[0], func, type, prop, topology);
        });

        it("registers multiple topologies", () => {
            const r = LinkedRenderStore.registerRenderer(func, type, prop, topologies);
            expect(r.length).toEqual(2);
            checkRegistration(r[0], func, type, prop, topologies[0]);
            checkRegistration(r[1], func, type, prop, topologies[1]);
        });

        it("registers combinations", () => {
            const r = LinkedRenderStore.registerRenderer(func, types, props, topologies);
            expect(r.length).toEqual(12);
        });
    });

    describe("#registerAll", () => {
        const reg1 = {
            component: (): string => "1",
            property: rdfFactory.id(schema.text),
            topology: DT,
            type: rdfFactory.id(schema.Thing),
        } as ComponentRegistration<() => string>;
        const reg2 = {
            component: (): string => "2",
            property: rdfFactory.id(schema.name),
            topology: rdfFactory.id(argu.ns("collection")),
            type: rdfFactory.id(schema.Person),
        } as ComponentRegistration<() => string>;

        it("stores multiple ComponentRegistration objects", () => {
            const store = getBasicStore();
            store.lrs.registerAll(reg1, reg2);
            expect(store.mapping.publicLookup(reg1.property, reg1.type, reg1.topology)).toEqual(reg1.component);
            expect(store.mapping.publicLookup(reg2.property, reg2.type, reg2.topology)).toEqual(reg2.component);
        });

        it("stores ComponentRegistration array", () => {
            const store = getBasicStore();
            store.lrs.registerAll([reg1, reg2]);
            expect(store.mapping.publicLookup(reg1.property, reg1.type, reg1.topology)).toEqual(reg1.component);
            expect(store.mapping.publicLookup(reg2.property, reg2.type, reg2.topology)).toEqual(reg2.component);
        });

        it("stores a single ComponentRegistration object", () => {
            const store = getBasicStore();
            store.lrs.registerAll(reg1);
            expect(store.mapping.publicLookup(reg1.property, reg1.type, reg1.topology)).toEqual(reg1.component);
            expect(store.mapping.publicLookup(reg2.property, reg2.type, reg2.topology)).not.toEqual(reg2.component);
        });
    });

    describe("#resourcePropertyComponent", () => {
        const store = getBasicStore();
        const resource = example("test");
        const property = schema.name;
        const nameComp = (): undefined => undefined;

        it("returns undefined when no view is registered", () => {
            expect(store.lrs.resourcePropertyComponent(resource, property)).toBeUndefined();
        });

        it("returns the view when one is registered", () => {
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(nameComp, schema.Thing, property));
            store.store.addQuads([
                rdfFactory.quad(resource, rdf.type, schema.Thing),
            ]);

            expect(store.lrs.resourcePropertyComponent(resource, property)).toEqual(nameComp);
        });
    });

    describe("#resourceComponent", () => {
        const store = getBasicStore();
        const resource = example("test");
        const thingComp = (): undefined => undefined;

        it("returns undefined when no view is registered", () => {
            expect(store.lrs.resourceComponent(resource)).toBeUndefined();
        });

        it("returns the view when one is registered", () => {
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(thingComp, schema.Thing));
            store.store.addQuads([
                rdfFactory.quad(resource, rdf.type, schema.Thing),
            ]);

            expect(store.lrs.resourceComponent(resource)).toEqual(thingComp);
        });
    });
});
