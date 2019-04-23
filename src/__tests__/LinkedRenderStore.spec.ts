import "jest";
import {
    BlankNode,
    Literal,
    NamedNode,
    Quadruple,
    Statement,
} from "rdflib";

import {
    LinkedRenderStore,
} from "../LinkedRenderStore";
import { getBasicStore } from "../testUtilities";
import { ComponentRegistration, SomeNode, SubscriptionRegistrationBase } from "../types";
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
        NamedNode.find("http://www.w3.org/wiki/WebSchemas/SchemaDotOrgSources#source_rNews"),
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
                new Statement(id, NS.schema("author"), NamedNode.find("http://example.org/people/0")),

                new Statement(idSecond, NS.rdf("type"), NS.schema("CreativeWork")),
                new Statement(idSecond, NS.schema("name"), new Literal("other")),

                new Statement(idSecond, NS.owl("sameAs"), id),
            ];

            store.store.addStatements(testData);
            const entity = await store.lrs.tryEntity(id) as Statement[];

            expect(entity.map((s) => s.object.toString())).toContainEqual("other");
        });
    });

    describe("subscriptions", () => {
        describe("in bulk", () => {
            it("registers the subscription", async () => {
                const store = getBasicStore();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: false,
                };

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();
            });

            it("calls the subscription", async () => {
                const store = getBasicStore();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: false,
                };

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();

                await store.forceBroadcast();
                expect(callback).toHaveBeenCalled();
            });
        });

        describe("subject filtered", () => {
            it("registers the subscription", async () => {
                const store = getBasicStore();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: true,
                    subjectFilter: [schemaT],
                };

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();
            });

            it("skips the subscription when irrelevant", async () => {
                const store = getBasicStore();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: true,
                    subjectFilter: [schemaT],
                };

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();

                await store.forceBroadcast();
                expect(callback).not.toHaveBeenCalled();
            });

            it("calls the subscription when relevant", async () => {
                const store = getBasicStore();
                await store.forceBroadcast();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: true,
                    subjectFilter: [schemaT],
                } as SubscriptionRegistrationBase<any>;

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();

                store.store.addStatements([Statement.from(schemaT, NS.schema("name"), new Literal("Thing"))]);
                await store.forceBroadcast();
                expect(callback).toHaveBeenCalledTimes(1);
                expect(callback.mock.calls[0][0]).toEqual([schemaT.sI]);
                expect(callback.mock.calls[0][1]).toBeGreaterThanOrEqual(reg.subscribedAt!);
                expect(callback.mock.calls[0][1]).toBeLessThan(Date.now());
            });
        });
    });

    describe("#dig", () => {
        const store = getBasicStore();
        const start = NS.ex("1");
        const bn = new BlankNode();
        store.store.addStatements([
            new Statement(start, NS.ex("oneToOne"), NS.ex("1.1")),

            new Statement(start, NS.ex("oneToOneLiteral"), NS.ex("1.2")),

            new Statement(start, NS.ex("oneToOneBN"), bn),

            new Statement(start, NS.ex("oneToOneMissing"), NS.ex("1.3")),

            new Statement(start, NS.ex("oneToMany"), NS.ex("1.4")),
            new Statement(start, NS.ex("oneToMany"), NS.ex("1.5")),

            new Statement(start, NS.ex("oneToManyHoley"), NS.ex("1.6")),
            new Statement(start, NS.ex("oneToManyHoley"), NS.ex("1.7")),
            new Statement(start, NS.ex("oneToManyHoley"), NS.ex("1.8")),

            new Statement(NS.ex("1.2"), NS.ex("p"), new Literal("value", "en")),

            new Statement(bn, NS.ex("p"), new Literal("test")),

            new Statement(NS.ex("1.2"), NS.ex("p"), new Literal("value", "nl")),

            new Statement(NS.ex("1.2"), NS.ex("p"), NS.ex("2.3")),

            new Statement(NS.ex("1.4"), NS.ex("p"), NS.ex("2.4")),
            new Statement(NS.ex("1.5"), NS.ex("p"), NS.ex("2.5")),

            new Statement(NS.ex("1.6"), NS.ex("p"), NS.ex("2.6")),
            new Statement(NS.ex("1.7"), NS.ex("p"), NS.ex("2.7")),
            new Statement(NS.ex("1.8"), NS.ex("p"), NS.ex("2.8")),

            new Statement(NS.ex("2.6"), NS.ex("q"), NS.ex("3.6")),
            new Statement(NS.ex("2.7"), NS.ex("other"), NS.ex("3.7")),
            new Statement(NS.ex("2.8"), NS.ex("q"), NS.ex("3.8")),
        ]);
        store.store.flush();

        it("is empty without path", () => expect(store.lrs.dig(start, [])).toEqual([]));

        it("resolves oneToOne", () => expect(store.lrs.dig(start, [NS.ex("oneToOne")])).toEqual([NS.ex("1.1")]));

        it("resolves literals through oneToOne", () => {
            expect(store.lrs.dig(start, [NS.ex("oneToOneLiteral"), NS.ex("p")]))
                .toEqual([new Literal("value", "en"), new Literal("value", "nl"), NS.ex("2.3")]);
        });

        it("resolves blank nodes through oneToOne", () => {
            expect(store.lrs.dig(start, [NS.ex("oneToOneBN"), NS.ex("p")]))
                .toEqual([new Literal("test")]);
        });

        it("resolves oneToMany", () => {
            expect(store.lrs.dig(start, [NS.ex("oneToMany")]))
                .toEqual([NS.ex("1.4"), NS.ex("1.5")]);
        });

        it("resolves values through oneToMany", () => {
            expect(store.lrs.dig(start, [NS.ex("oneToMany"), NS.ex("p")]))
                .toEqual([NS.ex("2.4"), NS.ex("2.5")]);
        });

        it("resolves values through holey oneToMany", () => {
            expect(store.lrs.dig(start, [NS.ex("oneToManyHoley"), NS.ex("p"), NS.ex("q")]))
                .toEqual([NS.ex("3.6"), NS.ex("3.8")]);
        });

        it("resolves empty through holey oneToMany without end value", () => {
            expect(store.lrs.dig(start, [NS.ex("oneToManyHoley"), NS.ex("p"), NS.ex("nonexistent")]))
                .toEqual([]);
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
            new Statement(entryPoint, NS.schema("image"), NamedNode.find("http://fontawesome.io/icon/plus")),
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

    describe("#getStatus", () => {
        it("resolves empty status for blank nodes", () => {
            const store = getBasicStore();
            const resource = new BlankNode();
            const status = store.lrs.getStatus(resource);

            expect(status).toHaveProperty("status", null);
        });

        it("resolves queued status for resources in the queue", () => {
            const store = getBasicStore();
            const resource = NS.example("test");
            store.lrs.queueEntity(resource);
            const status = store.lrs.getStatus(resource);

            expect(status).toHaveProperty("status", 202);
        });

        it("delegates to the api for other resources", () => {
            const store = getBasicStore();
            const resource = NS.example("test");
            const exStatus = { status: 259 };
            (store.processor as any).statusMap[resource.sI] = exStatus;
            const status = store.lrs.getStatus(resource);

            expect(status).toHaveProperty("status", 259);
        });
    });

    describe("#queueDelta", () => {
        const quadDelta = [
            [NS.ex("1"), NS.ex("p"), NS.ex("2"), NS.ll("add")],
            [NS.ex("1"), NS.ex("t"), new Literal("Test"), NS.ll("add")],
            [NS.ex("2"), NS.ex("t"), new Literal("Value"), NS.ll("add")],
        ] as Quadruple[];

        it("queues an empty delta", () => {
            const store = getBasicStore();

            store.lrs.queueDelta([]);
        });

        it("queues a quadruple delta", () => {
            const processor = {
                flush: jest.fn(),
                processDelta: jest.fn(),
                queueDelta: jest.fn(),
            };
            const store = getBasicStore();
            store.lrs.deltaProcessors.push(processor);

            store.lrs.queueDelta(quadDelta);

            expect(processor.queueDelta).toHaveBeenCalledTimes(1);
            expect(processor.queueDelta).toHaveBeenCalledWith(quadDelta, [NS.ex("1").sI, NS.ex("2").sI]);
        });

        it("queues a statement delta", () => {
            const processor = {
                flush: jest.fn(),
                processDelta: jest.fn(),
                queueDelta: jest.fn(),
            };
            const store = getBasicStore();
            store.lrs.deltaProcessors.push(processor);

            const delta = [
                new Statement(NS.ex("1"), NS.ex("p"), NS.ex("2"), NS.ll("add")),
                new Statement(NS.ex("1"), NS.ex("t"), new Literal("Test"), NS.ll("add")),
                new Statement(NS.ex("2"), NS.ex("t"), new Literal("Value"), NS.ll("add")),
            ];
            store.lrs.queueDelta(delta);

            expect(processor.queueDelta).toHaveBeenCalledTimes(1);
            expect(processor.queueDelta).toHaveBeenCalledWith(quadDelta, [NS.ex("1").sI, NS.ex("2").sI]);
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

    describe("#removeResource", () => {
        it("resolves after removal", () => {
            const store = getBasicStore();
            store.store.addStatements([
                ...thingStatements,
                ...creativeWorkStatements,
            ]);
            store.store.flush();
            const res = store.lrs.removeResource(schemaT);

            expect(res).resolves.toBeUndefined();
        });

        it("removes the resource", () => {
            const store = getBasicStore();
            store.store.addStatements([
                ...thingStatements,
                ...creativeWorkStatements,
            ]);
            store.store.flush();
            store.lrs.removeResource(schemaT);

            expect(store.lrs.tryEntity(schemaT)).toHaveLength(0);
        });

        it("calls the subscriber", async () => {
            const store = getBasicStore();
            const sub = jest.fn();
            store.lrs.subscribe({
                callback: sub,
                markedForDelete: false,
                onlySubjects: true,
                subjectFilter: [schemaT],
            });
            store.store.addStatements([
                ...thingStatements,
                ...creativeWorkStatements,
            ]);
            store.store.flush();
            await store.lrs.removeResource(schemaT, true);

            expect(sub).toHaveBeenCalledTimes(1);
        });
    });

    describe("#reset", () => {
        const store = getBasicStore();
        store.lrs.reset();
        const openStore = store.lrs as any;

        it("reinitialized the store", () => expect(openStore.store).not.toEqual(store.store));
        it("reinitialized the schema", () => expect(openStore.schema).not.toEqual(store.schema));
        it("reinitialized the mapping", () => expect(openStore.mapping).not.toEqual(store.mapping));
    });

    describe("#resourcePropertyComponent", () => {
        const store = getBasicStore();
        const resource = NS.example("test");
        const property = NS.schema("name");
        const nameComp = (): undefined => undefined;

        it("returns undefined when no view is registered", () => {
            expect(store.lrs.resourcePropertyComponent(resource, property)).toBeUndefined();
        });

        it("returns the view when one is registered", () => {
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(nameComp, NS.schema("Thing"), property));
            store.store.addStatements([
                new Statement(resource, NS.rdf("type"), NS.schema("Thing")),
            ]);

            expect(store.lrs.resourcePropertyComponent(resource, property)).toEqual(nameComp);
        });
    });

    describe("#resourceComponent", () => {
        const store = getBasicStore();
        const resource = NS.example("test");
        const thingComp = (): undefined => undefined;

        it("returns undefined when no view is registered", () => {
            expect(store.lrs.resourceComponent(resource)).toBeUndefined();
        });

        it("returns the view when one is registered", () => {
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(thingComp, NS.schema("Thing")));
            store.store.addStatements([
                new Statement(resource, NS.rdf("type"), NS.schema("Thing")),
            ]);

            expect(store.lrs.resourceComponent(resource)).toEqual(thingComp);
        });
    });

    describe("#shouldLoadResource", () => {
        const resource = NS.example("test");

        it("should load nonexistent resources", () => {
            const store = getBasicStore();
            store.store.flush();

            expect(store.lrs.shouldLoadResource(resource)).toBeTruthy();
        });

        it("should load invalidated resources", () => {
            const store = getBasicStore();
            store.store.addStatements([
                new Statement(resource, NS.rdfs("label"), new Literal("test")),
            ]);
            store.store.flush();
            store.processor.invalidate(resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeTruthy();
        });

        it("should not load existent resources", () => {
            const store = getBasicStore();
            store.store.addStatements([
                new Statement(resource, NS.rdfs("label"), new Literal("test")),
            ]);
            store.store.flush();

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
        });

        it("should not load queued resources", () => {
            const store = getBasicStore();
            store.store.flush();
            store.lrs.queueEntity(resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
        });

        it("should not load invalidated queued resources", () => {
            const store = getBasicStore();
            store.store.flush();
            store.store.addStatements([
                new Statement(resource, NS.rdfs("label"), new Literal("test")),
            ]);
            store.store.flush();
            store.processor.invalidate(resource);
            store.lrs.queueEntity(resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeFalsy();
        });
    });

    describe("#tryEntity", () => {
        it("resolves statements for the resource", () => {
            const store = getBasicStore();
            const resource = NS.ex("1");
            const testData = [
                new Statement(resource, NS.rdf("type"), NS.ex("Organization")),
                new Statement(resource, NS.schema("name"), new Literal("Some org")),
                new Statement(resource, NS.schema("employee"), NS.ex("2")),
            ];
            store.store.addStatements(testData);
            store.store.flush();

            const data = store.lrs.tryEntity(resource);
            expect(data).toHaveLength(3);
            expect(data).toContain(testData[0]);
            expect(data).toContain(testData[1]);
            expect(data).toContain(testData[2]);
        });
    });
});
