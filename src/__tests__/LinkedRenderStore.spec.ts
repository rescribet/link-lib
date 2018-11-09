import "jest";
import {
    Literal,
    NamedNode,
    Statement,
    Term,
} from "rdflib";

import {
    LinkedRenderStore,
} from "../LinkedRenderStore";
import { getBasicStore } from "../testUtilities";
import { ComponentRegistration, SomeNode } from "../types";
import { defaultNS as NS } from "../utilities/constants";
import { DEFAULT_TOPOLOGY, RENDER_CLASS_NAME } from "../utilities/constants";

const DT = DEFAULT_TOPOLOGY.sI;
const RCN = RENDER_CLASS_NAME.sI;

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
        Term.namedNodeByIRI("http://www.w3.org/wiki/WebSchemas/SchemaDotOrgSources#source_rNews"),
    ),
    new Statement(
        schemaCW,
        NS.rdfs("comment"),
        new Literal("The most generic kind of creative work, including books, movies, [...], etc."),
    ),
];

describe("LinkedRenderStore", () => {
    describe("adds new graph items", () => {
        it("add a single graph item", () => {
            const store = getBasicStore();
            store.lrs.addOntologySchematics(thingStatements);
            expect(store.schema.isInstanceOf(schemaT.sI, NS.rdfs("Class").sI)).toBeTruthy();
        });

        it("adds multiple graph items", () => {
            const store = getBasicStore();
            store.lrs.addOntologySchematics(thingStatements.concat(creativeWorkStatements));
            expect(store.schema.isInstanceOf(schemaT.sI, NS.rdfs("Class").sI)).toBeTruthy();
            expect(store.schema.isInstanceOf(schemaCW.sI, NS.rdfs("Class").sI)).toBeTruthy();
        });
    });

    describe("type renderer", () => {
        it("registers with full notation", () => {
            const store = getBasicStore();
            const comp = (): string => "a";
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(comp, NS.schema("Thing")));
            const thingComp = store.mapping.getRenderComponent(
                [NS.schema("Thing").sI],
                [RCN],
                DT,
                NS.rdfs("Resource").sI,
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
                [NS.schema("Thing").sI],
                [RCN],
                DT,
                NS.rdfs("Resource").sI,
            );
            expect(thingComp).toEqual(comp);
            const cwComp = store.mapping.getRenderComponent(
                [NS.schema("CreativeWork").sI],
                [RCN],
                DT,
                NS.rdfs("Resource").sI,
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
                [NS.schema("Thing").sI],
                [NS.schema("name").sI],
                DT,
                NS.rdfs("Resource").sI,
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
                    [NS.schema("Thing").sI],
                    [prop.sI],
                    DT,
                    NS.rdfs("Resource").sI,
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
                new Statement(id, NS.schema("author"), Term.namedNodeByIRI("http://example.org/people/0")),

                new Statement(idSecond, NS.rdf("type"), NS.schema("CreativeWork")),
                new Statement(idSecond, NS.schema("name"), new Literal("other")),

                new Statement(idSecond, NS.owl("sameAs"), id),
            ];

            store.store.addStatements(testData);
            const entity = await store.lrs.tryEntity(id) as Statement[];

            expect(entity.map((s) => s.object.toString())).toContainEqual("other");
        });
    });

    describe("#execActionByIRI", () => {
        const store = getBasicStore();
        const action = NS.example("location/everest/pictures/create");
        const entryPoint = NS.example("location/everest/pictures/create#entrypoint");
        const actionStatements = [
            new Statement(action, NS.rdf("type"), NS.schema("CreateAction")),
            new Statement(action, NS.schema("name"), new Literal("Upload a picture of Mt. Everest!")),
            new Statement(action, NS.schema("object"), NS.example("location/everest")),
            new Statement(action, NS.schema("result"), NS.schema("ImageObject")),
            new Statement(action, NS.schema("target"), NS.example("location/everest/pictures/create#entrypoint")),

            new Statement(entryPoint, NS.rdf("type"), NS.schema("Entrypoint")),
            new Statement(entryPoint, NS.schema("httpMethod"), new Literal("POST")),
            new Statement(entryPoint, NS.schema("url"), NS.example("location/everest/pictures")),
            new Statement(entryPoint, NS.schema("image"), Term.namedNodeByIRI("http://fontawesome.io/icon/plus")),
            new Statement(entryPoint, NS.schema("name"), new Literal("Add a picture")),
        ];
        store.store.addStatements(actionStatements);

        it("sends the described request", async () => {
            const sub = jest.fn();
            store.lrs.subscribe({ callback: sub, markedForDelete: false, onlySubjects: false });

            const response = await store.lrs.execActionByIRI(action);

            expect(response).toEqual({
                data: [],
                iri: null,
            });
            expect(sub).toHaveBeenCalledTimes(1);
        });
    });

    describe("#findSubject", () => {
        const store = getBasicStore();
        const bill = new Literal("Bill");
        const bookTitle = new Literal("His first work");
        const alternativeTitle = new Literal("Some alternative title");
        const testData = [
            new Statement(NS.ex("1"), NS.rdf("type"), NS.ex("Organization")),
            new Statement(NS.ex("1"), NS.schema("name"), new Literal("Some org")),
            new Statement(NS.ex("1"), NS.schema("employee"), NS.ex("2")),

            new Statement(NS.ex("2"), NS.rdf("type"), NS.schema("Person")),
            new Statement(NS.ex("2"), NS.schema("name"), bill),
            new Statement(NS.ex("2"), NS.schema("author"), NS.ex("3")),
            new Statement(NS.ex("2"), NS.schema("author"), NS.ex("4")),

            new Statement(NS.ex("3"), NS.rdf("type"), NS.schema("Book")),
            new Statement(NS.ex("3"), NS.schema("name"), bookTitle),
            new Statement(NS.ex("3"), NS.schema("name"), alternativeTitle),
            new Statement(NS.ex("3"), NS.schema("numberOfPages"), Literal.fromNumber(75)),

            new Statement(NS.ex("4"), NS.rdf("type"), NS.schema("Book")),
            new Statement(NS.ex("4"), NS.schema("name"), new Literal("His second work")),
            new Statement(NS.ex("4"), NS.schema("numberOfPages"), Literal.fromNumber(475)),
            new Statement(NS.ex("4"), NS.schema("bookEdition"), new Literal("1st")),
        ];
        store.store.addStatements(testData);

        it("resolves an empty path to nothing", () => {
            const answer = store.lrs.findSubject(NS.ex("1"), [], NS.ex("2"));
            expect(answer).toHaveLength(0);
        });

        it("resolves unknown subject to nothing", () => {
            const answer = store.lrs.findSubject(NS.ex("x"), [NS.schema("name")], bill);
            expect(answer).toHaveLength(0);
        });

        it("resolves first order matches", () => {
            const answer = store.lrs.findSubject(NS.ex("2"), [NS.schema("name")], bill);
            expect(answer).toEqual([NS.ex("2")]);
        });

        it("resolves second order matches", () => {
            const answer = store.lrs.findSubject(
                NS.ex("1"),
                [NS.schema("employee"), NS.schema("name")],
                new Literal("Bill"),
            );
            expect(answer).toEqual([NS.ex("2")]);
        });

        it("resolves third order matches", () => {
            const answer = store.lrs.findSubject(
                NS.ex("1"),
                [NS.schema("employee"), NS.schema("author"), NS.schema("name")],
                bookTitle,
            );
            expect(answer).toEqual([NS.ex("3")]);
        });

        it("resolves third order array matches", () => {
            const answer = store.lrs.findSubject(
                NS.ex("1"),
                [NS.schema("employee"), NS.schema("author"), NS.schema("name")],
                [bill, alternativeTitle],
            );
            expect(answer).toEqual([NS.ex("3")]);
        });
    });

    describe("#registerAll", () => {
        const reg1 = {
            component: (): string => "1",
            property: NS.schema("text").sI,
            topology: DT,
            type: NS.schema("Thing").sI,
        } as ComponentRegistration<() => string>;
        const reg2 = {
            component: (): string => "2",
            property: NS.schema("name").sI,
            topology: NS.argu("collection").sI,
            type: NS.schema("Person").sI,
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
            expect(r.type).toEqual(t.sI);
            expect(r.property).toEqual(p.sI);
            expect(r.topology).toEqual(top.sI);
        }

        it("does not register without component", () => {
            const defaultMsg = `Undefined component was given for (${type.sI}, ${RCN}, ${DT}).`;
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
