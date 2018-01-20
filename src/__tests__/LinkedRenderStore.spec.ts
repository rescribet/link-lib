import "jest";
import {
    BlankNode,
    Literal,
    NamedNode,
    Statement,
} from "rdflib";

import {
    DEFAULT_TOPOLOGY,
    LinkedRenderStore,
    parseIRI,
    parseNode,
    parseTerm,
    RENDER_CLASS_NAME,
} from "../LinkedRenderStore";
import { getBasicStore } from "../testUtilities";
import { ComponentRegistration, SomeNode } from "../types";
import { defaultNS as NS } from "../utilities";

const DT = DEFAULT_TOPOLOGY;
const RCN = RENDER_CLASS_NAME;

const schemaT = NS.schema("Thing");
const thingStatements = [
    new Statement(schemaT, NS.rdf("type"), NS.rdfs("Class")),
    new Statement(schemaT, NS.rdfs("comment"), new Literal("The most generic type of item.")),
    new Statement(schemaT, NS.rdfs("label"), new Literal("Thing.")),
];

const schemaCW = NS.schema("CreativeWork");
const creativeWorkStatements = [
    new Statement(schemaCW, NS.rdf("type"), NS.rdfs("Class")),
    new Statement(schemaCW, NS.rdfs("label"), new Literal("CreativeWork")),
    new Statement(schemaCW, NS.rdfs("subClassOf"), schemaT),
    new Statement(
        schemaCW,
        NS.dc("source"),
        new NamedNode("http://www.w3.org/wiki/WebSchemas/SchemaDotOrgSources#source_rNews"),
    ),
    new Statement(
        schemaCW,
        NS.rdfs("comment"),
        new Literal("The most generic kind of creative work, including books, movies, [...], etc."),
    ),
];

describe("LinkedRenderStore", () => {
    describe("expands properties correctly", () => {
        const LRS = new LinkedRenderStore();
        it("expands short to long notation", () => {
            const nameShort = LRS.expandProperty("schema:name");
            if (nameShort === undefined) {
                throw new TypeError();
            }
            expect(NS.schema("name").sameTerm(nameShort)).toBeTruthy();
        });

        it("preserves long notation", () => {
            const nameLong = LRS.expandProperty("http://schema.org/name");
            if (nameLong === undefined) {
                throw new TypeError();
            }
            expect(NS.schema("name").sameTerm(nameLong)).toBeTruthy();
        });
    });

    describe("adds new graph items", () => {
        it("add a single graph item", () => {
            const store = getBasicStore();
            store.lrs.addOntologySchematics(thingStatements);
            expect(store.schema.isInstanceOf(schemaT, NS.rdfs("Class"))).toBeTruthy();
        });

        it("adds multiple graph items", () => {
            const store = getBasicStore();
            store.lrs.addOntologySchematics(thingStatements.concat(creativeWorkStatements));
            expect(store.schema.isInstanceOf(schemaT, NS.rdfs("Class"))).toBeTruthy();
            expect(store.schema.isInstanceOf(schemaCW, NS.rdfs("Class"))).toBeTruthy();
        });
    });

    describe("type renderer", () => {
        it("registers with full notation", () => {
            const store = getBasicStore();
            const comp = (): string => "a";
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(comp, NS.schema("Thing")));
            const thingComp = store.mapping.getRenderComponent(
                [NS.schema("Thing")],
                [RCN],
                DT,
                NS.rdfs("Resource"),
            );
            expect(thingComp).toEqual(comp);
        });

        it("registers with multiple types", () => {
            const store = getBasicStore();
            const comp = (): string => "a";
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(
                comp,
                [NS.schema("Thing"), NS.schema("CreativeWork")],
            ));
            const thingComp = store.mapping.getRenderComponent(
                [NS.schema("Thing")],
                [RCN],
                DT,
                NS.rdfs("Resource"),
            );
            expect(thingComp).toEqual(comp);
            const cwComp = store.mapping.getRenderComponent(
                [NS.schema("CreativeWork")],
                [RCN],
                DT,
                NS.rdfs("Resource"),
            );
            expect(cwComp).toEqual(comp);
        });
    });

    describe("property renderer", () => {
        it("registers with full notation", () => {
            const store = getBasicStore();
            const ident = (): string => "a";
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(ident, NS.schema("Thing"), NS.schema("name")));
            const nameComp = store.mapping.getRenderComponent(
                [NS.schema("Thing")],
                [NS.schema("name")],
                DT,
                NS.rdfs("Resource"),
            );
            expect(nameComp).toEqual(ident);
        });

        it("registers multiple", () => {
            const store = getBasicStore();
            const ident = (): string => "a";
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(
                ident,
                NS.schema("Thing"),
                [NS.schema("name"), NS.rdfs("label")],
            ));
            [NS.schema("name"), NS.rdfs("label")].forEach((prop) => {
                const nameComp = store.mapping.getRenderComponent(
                    [NS.schema("Thing")],
                    [prop],
                    DT,
                    NS.rdfs("Resource"),
                );
                expect(nameComp).toEqual(ident);
                expect(nameComp).not.toEqual((): string => "b");
            });
        });
    });

    describe("returns renderer for", () => {
        it("class renders", () => {
            const LRS = new LinkedRenderStore();
            expect(LRS.getComponentForType(NS.schema("Thing"))).toBeUndefined();
            const ident = (a: string): string => a;
            const registrations = LinkedRenderStore.registerRenderer(ident, NS.schema("Thing"));
            LRS.registerAll(registrations);
            const klass = LRS.getComponentForType(NS.schema("Thing"));
            expect(klass).toEqual(ident);
            expect(klass).not.toEqual((a: string): string => a);
        });

        it("property renders", () => {
            const LRS = new LinkedRenderStore();
            const ident = (a: string): string => a;
            const registrations = LinkedRenderStore.registerRenderer(
                ident,
                NS.schema("Thing"),
                NS.schema("name"),
            );
            LRS.registerAll(registrations);
            const klass = LRS.getComponentForProperty(NS.schema("Thing"), NS.schema("name"));
            expect(klass).toEqual(ident);
            expect(klass).not.toEqual((a: string): string => a);
        });
    });

    describe("reasons correctly", () => {
        it("combines sameAs declarations", async () => {
            const store = getBasicStore();

            const id = NS.example("sameFirst");
            const idSecond = NS.example("sameSecond");
            const testData = [
                new Statement(id, NS.rdf("type"), NS.schema("CreativeWork")),
                new Statement(id, NS.schema("text"), new Literal("text")),
                new Statement(id, NS.schema("author"), new NamedNode("http://example.org/people/0")),

                new Statement(idSecond, NS.rdf("type"), NS.schema("CreativeWork")),
                new Statement(idSecond, NS.schema("name"), new Literal("other")),

                new Statement(idSecond, NS.owl("sameAs"), id),
            ];

            store.store.addStatements(testData);
            const entity = await store.lrs.tryEntity(id) as Statement[];

            expect(entity.map((s) => s.object.toString())).toContainEqual("other");
        });
    });

    describe("#registerAll", () => {
        const reg1 = {
            component: (): string => "1",
            property: NS.schema("text"),
            topology: DEFAULT_TOPOLOGY,
            type: NS.schema("Thing"),
        } as ComponentRegistration<() => string>;
        const reg2 = {
            component: (): string => "2",
            property: NS.schema("name"),
            topology: NS.argu("collection"),
            type: NS.schema("Person"),
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

    describe("::registerRenderer", () => {
        const func = (): void => undefined;
        const type = NS.schema("Thing");
        const types = [NS.schema("Thing"), NS.schema("Person")];
        const prop = NS.schema("name");
        const props = [NS.schema("name"), NS.schema("text"), NS.schema("dateCreated")];
        const topology = NS.argu("collection");
        const topologies = [NS.argu("collection"), NS.argu("collection")];

        function checkRegistration<T>(r: ComponentRegistration<T>,
                                      c: T,
                                      t: SomeNode,
                                      p: NamedNode,
                                      top: SomeNode): void {
            expect(r.component).toEqual(c);
            expect(r.type).toEqual(t);
            expect(r.property).toEqual(p);
            expect(r.topology).toEqual(top);
        }

        it("does not register without component", () => {
            const defaultMsg = `Undefined component was given for (${type}, ${RCN}, ${DT}).`;
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
});
