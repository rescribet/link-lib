import "jest";
import "./useHashFactory";

import rdfFactory, {
    NamedNode,
    Quad,
    Quadruple,
} from "@ontologies/core";
import dcterms from "@ontologies/dcterms";
import owl from "@ontologies/owl";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import schema from "@ontologies/schema";

import {
    LinkedRenderStore,
} from "../LinkedRenderStore";
import { createNS } from "../rdf";
import { getBasicStore } from "../testUtilities";
import { ComponentRegistration, SomeNode, SubscriptionRegistrationBase } from "../types";
import { defaultNS as NS } from "../utilities/constants";
import { DEFAULT_TOPOLOGY, RENDER_CLASS_NAME } from "../utilities/constants";

const DT = rdfFactory.id(DEFAULT_TOPOLOGY);
const RCN = rdfFactory.id(RENDER_CLASS_NAME);

const schemaT = schema.Thing;
const thingStatements = [
    rdfFactory.quad(schemaT, rdf.type, rdfs.Class),
    rdfFactory.quad(schemaT, rdfs.comment, rdfFactory.literal("The most generic type of item.")),
    rdfFactory.quad(schemaT, rdfs.label, rdfFactory.literal("Thing.")),
];

const schemaCW = schema.CreativeWork;
const creativeWorkStatements = [
    rdfFactory.quad(schemaCW, rdf.type, rdfs.Class),
    rdfFactory.quad(schemaCW, rdfs.label, rdfFactory.literal("CreativeWork")),
    rdfFactory.quad(schemaCW, rdfs.subClassOf, schemaT),
    rdfFactory.quad(
        schemaCW,
        dcterms.source,
        rdfFactory.namedNode("http://www.w3.org/wiki/WebSchemas/SchemaDotOrgSources#source_rNews"),
    ),
    rdfFactory.quad(
        schemaCW,
        rdfs.comment,
        rdfFactory.literal("The most generic kind of creative work, including books, movies, [...], etc."),
    ),
];

const example = createNS("http://example.com/");
const ex = createNS("http://example.com/ns#");
const ldNS = createNS("http://purl.org/linked-delta/");
const ld = {
    add: ldNS("add"),
    purge: ldNS("purge"),
    remove: ldNS("remove"),
    replace: ldNS("replace"),
    slice: ldNS("slice"),
    supplant: ldNS("supplant"),
};

describe("LinkedRenderStore", () => {
    describe("adds new graph items", () => {
        it("add a single graph item", () => {
            const store = getBasicStore();
            store.lrs.addOntologySchematics(thingStatements);
            expect(store.schema.isInstanceOf(rdfFactory.id(schemaT), rdfFactory.id(rdfs.Class))).toBeTruthy();
        });

        it("adds multiple graph items", () => {
            const store = getBasicStore();
            store.lrs.addOntologySchematics(thingStatements.concat(creativeWorkStatements));
            expect(store.schema.isInstanceOf(rdfFactory.id(schemaT), rdfFactory.id(rdfs.Class))).toBeTruthy();
            expect(store.schema.isInstanceOf(rdfFactory.id(schemaCW), rdfFactory.id(rdfs.Class))).toBeTruthy();
        });
    });

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

    describe("reasons correctly", () => {
        it("combines sameAs declarations", async () => {
            const store = getBasicStore();

            const id = example("sameFirst");
            const idSecond = example("sameSecond");
            const testData = [
                rdfFactory.quad(id, rdf.type, schema.CreativeWork),
                rdfFactory.quad(id, schema.text, rdfFactory.literal("text")),
                rdfFactory.quad(id, schema.author, rdfFactory.namedNode("http://example.org/people/0")),

                rdfFactory.quad(idSecond, rdf.type, schema.CreativeWork),
                rdfFactory.quad(idSecond, schema.name, rdfFactory.literal("other")),

                rdfFactory.quad(idSecond, owl.sameAs, id),
            ];

            store.store.addStatements(testData);
            const entity = await store.lrs.tryEntity(id) as Quad[];

            expect(entity.map((s) => s.object.value)).toContainEqual("other");
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

                store.store.addStatements([rdfFactory.quad(schemaT, schema.name, rdfFactory.literal("Thing"))]);
                await store.forceBroadcast();
                expect(callback).toHaveBeenCalledTimes(1);
                expect(callback.mock.calls[0][0]).toEqual([
                    rdfFactory.id(schemaT),
                    rdfFactory.id(rdfFactory.defaultGraph()),
                ]);
                expect(callback.mock.calls[0][1]).toBeGreaterThanOrEqual(reg.subscribedAt!);
                expect(callback.mock.calls[0][1]).toBeLessThan(Date.now());
            });
        });
    });

    describe("#dig", () => {
        const store = getBasicStore();
        const start = ex("1");
        const bn = rdfFactory.blankNode();
        store.store.addStatements([
            rdfFactory.quad(start, ex("oneToOne"), ex("1.1")),

            rdfFactory.quad(start, ex("oneToOneLiteral"), ex("1.2")),

            rdfFactory.quad(start, ex("oneToOneBN"), bn),

            rdfFactory.quad(start, ex("oneToOneMissing"), ex("1.3")),

            rdfFactory.quad(start, ex("oneToMany"), ex("1.4")),
            rdfFactory.quad(start, ex("oneToMany"), ex("1.5")),

            rdfFactory.quad(start, ex("oneToManyHoley"), ex("1.6")),
            rdfFactory.quad(start, ex("oneToManyHoley"), ex("1.7")),
            rdfFactory.quad(start, ex("oneToManyHoley"), ex("1.8")),

            rdfFactory.quad(ex("1.2"), ex("p"), rdfFactory.literal("value", "en")),

            rdfFactory.quad(bn, ex("p"), rdfFactory.literal("test")),

            rdfFactory.quad(ex("1.2"), ex("p"), rdfFactory.literal("value", "nl")),

            rdfFactory.quad(ex("1.2"), ex("p"), ex("2.3")),

            rdfFactory.quad(ex("1.4"), ex("p"), ex("2.4")),
            rdfFactory.quad(ex("1.5"), ex("p"), ex("2.5")),

            rdfFactory.quad(ex("1.6"), ex("p"), ex("2.6")),
            rdfFactory.quad(ex("1.7"), ex("p"), ex("2.7")),
            rdfFactory.quad(ex("1.8"), ex("p"), ex("2.8")),

            rdfFactory.quad(ex("2.6"), ex("q"), ex("3.6")),
            rdfFactory.quad(ex("2.7"), ex("other"), ex("3.7")),
            rdfFactory.quad(ex("2.8"), ex("q"), ex("3.8")),
        ]);
        store.store.flush();

        it("is empty without path", () => expect(store.lrs.dig(start, [])).toEqual([]));

        it("resolves oneToOne", () => expect(store.lrs.dig(start, [ex("oneToOne")])).toEqual([ex("1.1")]));

        it("resolves literals through oneToOne", () => {
            expect(store.lrs.dig(start, [ex("oneToOneLiteral"), ex("p")]))
                .toEqual([rdfFactory.literal("value", "en"), rdfFactory.literal("value", "nl"), ex("2.3")]);
        });

        it("resolves blank nodes through oneToOne", () => {
            expect(store.lrs.dig(start, [ex("oneToOneBN"), ex("p")]))
                .toEqual([rdfFactory.literal("test")]);
        });

        it("resolves oneToMany", () => {
            expect(store.lrs.dig(start, [ex("oneToMany")]))
                .toEqual([ex("1.4"), ex("1.5")]);
        });

        it("resolves values through oneToMany", () => {
            expect(store.lrs.dig(start, [ex("oneToMany"), ex("p")]))
                .toEqual([ex("2.4"), ex("2.5")]);
        });

        it("resolves values through holey oneToMany", () => {
            expect(store.lrs.dig(start, [ex("oneToManyHoley"), ex("p"), ex("q")]))
                .toEqual([ex("3.6"), ex("3.8")]);
        });

        it("resolves empty through holey oneToMany without end value", () => {
            expect(store.lrs.dig(start, [ex("oneToManyHoley"), ex("p"), ex("nonexistent")]))
                .toEqual([]);
        });
    });

    describe("#execActionByIRI", () => {
        const store = getBasicStore();
        const action = example("location/everest/pictures/create");
        const entryPoint = example("location/everest/pictures/create#entrypoint");
        const actionStatements = [
            rdfFactory.quad(action, rdf.type, schema.CreateAction),
            rdfFactory.quad(action, schema.name, rdfFactory.literal("Upload a picture of Mt. Everest!")),
            rdfFactory.quad(action, schema.object, example("location/everest")),
            rdfFactory.quad(action, schema.result, schema.ImageObject),
            rdfFactory.quad(action, schema.target, example("location/everest/pictures/create#entrypoint")),

            rdfFactory.quad(entryPoint, rdf.type, schema.EntryPoint),
            rdfFactory.quad(entryPoint, schema.httpMethod, rdfFactory.literal("POST")),
            rdfFactory.quad(entryPoint, schema.url, example("location/everest/pictures")),
            rdfFactory.quad(entryPoint, schema.image, rdfFactory.namedNode("http://fontawesome.io/icon/plus")),
            rdfFactory.quad(entryPoint, schema.name, rdfFactory.literal("Add a picture")),
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
        const bill = rdfFactory.literal("Bill");
        const bookTitle = rdfFactory.literal("His first work");
        const alternativeTitle = rdfFactory.literal("Some alternative title");
        const testData = [
            rdfFactory.quad(ex("1"), rdf.type, ex("Organization")),
            rdfFactory.quad(ex("1"), schema.name, rdfFactory.literal("Some org")),
            rdfFactory.quad(ex("1"), schema.employee, ex("2")),

            rdfFactory.quad(ex("2"), rdf.type, schema.Person),
            rdfFactory.quad(ex("2"), schema.name, bill),
            rdfFactory.quad(ex("2"), schema.author, ex("3")),
            rdfFactory.quad(ex("2"), schema.author, ex("4")),

            rdfFactory.quad(ex("3"), rdf.type, schema.Book),
            rdfFactory.quad(ex("3"), schema.name, bookTitle),
            rdfFactory.quad(ex("3"), schema.name, alternativeTitle),
            rdfFactory.quad(ex("3"), schema.numberOfPages, rdfFactory.literal(75)),

            rdfFactory.quad(ex("4"), rdf.type, schema.Book),
            rdfFactory.quad(ex("4"), schema.name, rdfFactory.literal("His second work")),
            rdfFactory.quad(ex("4"), schema.numberOfPages, rdfFactory.literal(475)),
            rdfFactory.quad(ex("4"), schema.bookEdition, rdfFactory.literal("1st")),
        ];
        store.store.addStatements(testData);

        it("resolves an empty path to nothing", () => {
            const answer = store.lrs.findSubject(ex("1"), [], ex("2"));
            expect(answer).toHaveLength(0);
        });

        it("resolves unknown subject to nothing", () => {
            const answer = store.lrs.findSubject(ex("x"), [schema.name], bill);
            expect(answer).toHaveLength(0);
        });

        it("resolves first order matches", () => {
            const answer = store.lrs.findSubject(ex("2"), [schema.name], bill);
            expect(answer).toEqual([ex("2")]);
        });

        it("resolves second order matches", () => {
            const answer = store.lrs.findSubject(
                ex("1"),
                [schema.employee, schema.name],
                rdfFactory.literal("Bill"),
            );
            expect(answer).toEqual([ex("2")]);
        });

        it("resolves third order matches", () => {
            const answer = store.lrs.findSubject(
                ex("1"),
                [schema.employee, schema.author, schema.name],
                bookTitle,
            );
            expect(answer).toEqual([ex("3")]);
        });

        it("resolves third order array matches", () => {
            const answer = store.lrs.findSubject(
                ex("1"),
                [schema.employee, schema.author, schema.name],
                [bill, alternativeTitle],
            );
            expect(answer).toEqual([ex("3")]);
        });
    });

    describe("#getStatus", () => {
        it("resolves empty status for blank nodes", () => {
            const store = getBasicStore();
            const resource = rdfFactory.blankNode();
            const status = store.lrs.getStatus(resource);

            expect(status).toHaveProperty("status", null);
        });

        it("resolves queued status for resources in the queue", () => {
            const store = getBasicStore();
            const resource = example("test");
            store.lrs.queueEntity(resource);
            const status = store.lrs.getStatus(resource);

            expect(status).toHaveProperty("status", 202);
        });

        it("delegates to the api for other resources", () => {
            const store = getBasicStore();
            const resource = example("test");
            const exStatus = { status: 259 };
            (store.processor as any).statusMap[rdfFactory.id(resource)] = exStatus;
            const status = store.lrs.getStatus(resource);

            expect(status).toHaveProperty("status", 259);
        });
    });

    describe("#queueDelta", () => {
        const quadDelta = [
            [ex("1"), ex("p"), ex("2"), ld.add],
            [ex("1"), ex("t"), rdfFactory.literal("Test"), ld.add],
            [ex("2"), ex("t"), rdfFactory.literal("Value"), ld.add],
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
            expect(processor.queueDelta).toHaveBeenCalledWith(
                quadDelta,
                [rdfFactory.id(ex("1")), rdfFactory.id(ex("2"))],
            );
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
                rdfFactory.quad(ex("1"), ex("p"), ex("2"), ld.add),
                rdfFactory.quad(ex("1"), ex("t"), rdfFactory.literal("Test"), ld.add),
                rdfFactory.quad(ex("2"), ex("t"), rdfFactory.literal("Value"), ld.add),
            ];
            store.lrs.queueDelta(delta);

            expect(processor.queueDelta).toHaveBeenCalledTimes(1);
            expect(processor.queueDelta).toHaveBeenCalledWith(
                quadDelta,
                [rdfFactory.id(ex("1")), rdfFactory.id(ex("2"))],
            );
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
            topology: rdfFactory.id(NS.argu("collection")),
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

    describe("::registerRenderer", () => {
        const func = (): void => undefined;
        const type = schema.Thing;
        const types = [schema.Thing, schema.Person];
        const prop = schema.name;
        const props = [schema.name, schema.text, schema.dateCreated];
        const topology = NS.argu("collection");
        const topologies = [NS.argu("collection"), NS.argu("collection")];

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
        const resource = example("test");
        const property = schema.name;
        const nameComp = (): undefined => undefined;

        it("returns undefined when no view is registered", () => {
            expect(store.lrs.resourcePropertyComponent(resource, property)).toBeUndefined();
        });

        it("returns the view when one is registered", () => {
            store.lrs.registerAll(LinkedRenderStore.registerRenderer(nameComp, schema.Thing, property));
            store.store.addStatements([
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
            store.store.addStatements([
                rdfFactory.quad(resource, rdf.type, schema.Thing),
            ]);

            expect(store.lrs.resourceComponent(resource)).toEqual(thingComp);
        });
    });

    describe("#shouldLoadResource", () => {
        const resource = example("test");

        it("should load nonexistent resources", () => {
            const store = getBasicStore();
            store.store.flush();

            expect(store.lrs.shouldLoadResource(resource)).toBeTruthy();
        });

        it("should load invalidated resources", () => {
            const store = getBasicStore();
            store.store.addStatements([
                rdfFactory.quad(resource, rdfs.label, rdfFactory.literal("test")),
            ]);
            store.store.flush();
            store.processor.invalidate(resource);

            expect(store.lrs.shouldLoadResource(resource)).toBeTruthy();
        });

        it("should not load existent resources", () => {
            const store = getBasicStore();
            store.store.addStatements([
                rdfFactory.quad(resource, rdfs.label, rdfFactory.literal("test")),
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
                rdfFactory.quad(resource, rdfs.label, rdfFactory.literal("test")),
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
            const resource = ex("1");
            const testData = [
                rdfFactory.quad(resource, rdf.type, ex("Organization")),
                rdfFactory.quad(resource, schema.name, rdfFactory.literal("Some org")),
                rdfFactory.quad(resource, schema.employee, ex("2")),
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
