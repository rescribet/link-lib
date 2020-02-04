import "jest";
import "./useHashFactory";

import rdfFactory, { HexPos, Hextuple } from "@ontologies/core";
import ld from "@ontologies/ld";
import owl from "@ontologies/owl";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import schema from "@ontologies/schema";
import xsd from "@ontologies/xsd";

import { createNS } from "../rdf";
import { RDFStore } from "../RDFStore";
import RDFIndex from "../store/RDFIndex";
import { getBasicStore } from "../testUtilities";
import { objectToHexObj } from "../utilities/hex";

const example = createNS("http://example.com/");
const ex = createNS("http://example.com/ns#");

const schemaT = schema.Thing;
const thingStatements = [
    rdfFactory.quad(schemaT, rdf.type, rdfs.Class, rdfFactory.defaultGraph()),
    rdfFactory.quad(schemaT, rdfs.comment, rdfFactory.literal("The most generic type"), rdfFactory.defaultGraph()),
    rdfFactory.quad(schemaT, rdfs.label, rdfFactory.literal("Thing."), rdfFactory.defaultGraph()),
];
const aboutIsThing = [
    rdfFactory.quad(schema.AboutPage, owl.sameAs, schemaT),
];
const thingIsAbout = [
    rdfFactory.quad(schemaT, owl.sameAs, schema.AboutPage),
];

describe("RDFStore", () => {
    describe("#addStatements", () => {
        it("requires an array", () => {
            const store = new RDFStore();

            expect(() => {
                store.addHextuples("test" as any);
            }).toThrowError(TypeError);
        });

        it("works", () => {
            const store = new RDFStore();
            store.addHextuples(thingStatements);

            const libStatements = store.getInternalStore().quads;
            expect(libStatements).toHaveLength(3);
            expect(libStatements[0]).toEqual(thingStatements[0]);
            expect(libStatements[1]).toEqual(thingStatements[1]);
            expect(libStatements[2]).toEqual(thingStatements[2]);
        });

        it("bumps the changeTimestamp", async () => {
            const store = getBasicStore();
            store.store.addHextuples([
                thingStatements[0],
            ]);
            await store.store.flush();
            const before = store.store.changeTimestamps[schemaT];

            await new Promise((resolve): void => { window.setTimeout(resolve, 100); });

            store.store.addHextuples([
                thingStatements[1],
                thingStatements[2],
            ]);
            await store.store.flush();
            expect(store.store.changeTimestamps[schemaT]).toBeGreaterThan(before);
        });

        describe("owl:sameAs", () => {
            describe("big small", () => {
                it("equates existing data", () => {
                    const store = getBasicStore();
                    store.store.addHextuples(aboutIsThing);
                    store.store.addHextuples(thingStatements);
                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(1);
                });

                it("equates new data", () => {
                    const store = getBasicStore();
                    store.store.addHextuples(thingStatements);
                    store.store.addHextuples(aboutIsThing);
                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(1);
                });
            });

            describe("small big", () => {
                it("equates existing data", () => {
                    const store = getBasicStore();
                    store.store.addHextuples(thingIsAbout);
                    store.store.addHextuples(thingStatements);
                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(1);
                });

                it("equates new data", () => {
                    const store = getBasicStore();
                    store.store.addHextuples(thingStatements);
                    store.store.addHextuples(thingIsAbout);
                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(1);
                });
            });
        });
    });

    describe("#flush", () => {
        it("is returns the work available", () => {
            const store = new RDFStore();
            store.addHextuples(thingStatements);
            const res = store.flush();
            expect(res[0]).toEqual(thingStatements[0]);
            expect(res[1]).toEqual(thingStatements[1]);
            expect(res[2]).toEqual(thingStatements[2]);
        });

        it("is returns a frozen empty array without work", () => {
            const res = new RDFStore().flush();
            expect(res.length).toEqual(0);
            expect(Object.isFrozen(res)).toBeTruthy();
        });
    });

    describe("#getInternalStore", () => {
        it("returns the store", () => {
            expect(new RDFStore().getInternalStore()).toBeInstanceOf(RDFIndex);
        });
    });

    describe("#replaceMatches", () => {
        it("replaces a statement", () => {
            const store = new RDFStore();
            store.addHextuples(thingStatements);

            const [v, dt, l] = objectToHexObj(rdfFactory.literal("Thing!"));
            const quads: Hextuple[] = [
                [schemaT, rdfs.label, v, dt, l, ld.replace],
            ];

            const before = store.matchHex(schemaT, rdfs.label, null, null, null, null);
            expect(before).toHaveLength(1);
            const [v2, dt2, l2] = rdfFactory.literal("Thing.");
            expect(before[0][HexPos.object]).toEqual(v2);
            expect(before[0][HexPos.objectDT]).toEqual(dt2);
            expect(before[0][HexPos.objectLang]).toEqual(l2);

            store.replaceMatches(quads);

            const after = store.matchHex(schemaT, rdfs.label, null, null, null, null);
            expect(after).toHaveLength(1);
            const [v3, dt3, l3] = rdfFactory.literal("Thing!", undefined, xsd.string);
            expect(after[0][HexPos.object]).toEqual(v3);
            expect(after[0][HexPos.objectDT]).toEqual(dt3);
            expect(after[0][HexPos.objectLang]).toEqual(l3);
        });
    });

    describe("#processDelta", () => {
        it("handles empty values", () => {
            const store = new RDFStore();

            expect(store.processDelta(new Array(1))).toEqual([]);
        });

        describe("ld:replace", () => {
            it("replaces existing", () => {
                const store = new RDFStore();

                expect(store.processDelta(new Array(1))).toEqual([]);
            });
        });

        describe("ld:remove", () => {
            it("removes one", () => {
                const store = new RDFStore();
                store.addHextuples(thingStatements);

                expect(store.match(null, null, null, null)).toHaveLength(thingStatements.length);

                const [v, dt, l] = rdfFactory.literal("irrelevant");
                const statements: Hextuple[] = [
                    [schemaT, rdfs.label, v, dt, l, ld.remove],
                ];

                store.processDelta(statements);

                expect(store.match(null, null, null, null)).toHaveLength(thingStatements.length - 1);
                expect(store.match(schemaT, rdfs.label, null, null)).toHaveLength(0);
            });

            it("removes many", () => {
                const store = new RDFStore();
                store.addHextuples(thingStatements);
                store.addHextuples([rdfFactory.quad(schemaT, rdfs.label, rdfFactory.literal("Thing gb", "en-gb"))]);

                expect(store.match(null, null, null, null)).toHaveLength(thingStatements.length + 1);

                const [v, dt, l] = rdfFactory.literal("irrelevant");
                const quads: Hextuple[] = [
                    [schemaT, rdfs.label, v, dt, l, ld.remove],
                ];

                store.processDelta(quads);

                expect(store.match(null, null, null, null)).toHaveLength(thingStatements.length - 1);
                expect(store.match(schemaT, rdfs.label, null, null)).toHaveLength(0);
            });
        });
    });

    describe("#replaceStatements", () => {
        it("replaces statements", () => {
            const old = [rdfFactory.quad(ex("a"), ex("p"), ex("x"), ex("g"))];
            const next = [rdfFactory.quad(ex("a"), ex("q"), ex("x"), ex("g"))];
            const store = new RDFStore();
            store.addHextuples(old);
            store.replaceQuads(old, next);

            expect(store.match(null, null, null, null)).toHaveLength(1);
            expect(store.match(ex("a"), null, null, null)[0]).toEqual(next[0]);
        });
    });

    describe("#getResourcePropertyRaw", () => {
        const store = new RDFStore();
        store.addHextuples([
            rdfFactory.quad(ex("a"), ex("p"), ex("x")),
            rdfFactory.quad(ex("a"), ex("r"), ex("y")),

            rdfFactory.quad(ex("b"), ex("p"), ex("xx")),
            rdfFactory.quad(ex("b"), ex("p"), ex("yy")),
        ]);

        it("resolves empty values for single property", () => {
            expect(store.getResourcePropertyRaw(ex("none"), ex("p")))
                .toEqual([]);
        });

        it("resolves empty values for multiple properties", () => {
            expect(store.getResourcePropertyRaw(ex("none"), [ex("p"), ex("q")]))
                .toEqual([]);
        });

        it("resolves values for single property", () => {
            expect(store.getResourcePropertyRaw(ex("b"), ex("p")))
                .toEqual([
                    rdfFactory.quad(ex("b"), ex("p"), ex("xx"), rdfFactory.namedNode("rdf:defaultGraph")),
                    rdfFactory.quad(ex("b"), ex("p"), ex("yy"), rdfFactory.namedNode("rdf:defaultGraph")),
                ]);
        });

        it("resolves value for multiple properties one existent", () => {
            expect(store.getResourcePropertyRaw(ex("a"), [ex("p"), ex("q")]))
                .toEqual([
                    rdfFactory.quad(ex("a"), ex("p"), ex("x"), rdfFactory.namedNode("rdf:defaultGraph")),
                ]);
        });

        it("resolves value for multiple properties multiple existent", () => {
            expect(store.getResourcePropertyRaw(ex("a"), [ex("r"), ex("p")]))
                .toEqual([
                    rdfFactory.quad(ex("a"), ex("r"), ex("y"), rdfFactory.namedNode("rdf:defaultGraph")),
                ]);
        });
    });

    describe("#getResourceProperty", () => {
        it("returns undefined for type statements on unloaded resources", () => {
            const store = new RDFStore();

            expect(store.getResourceProperty(ex("1"), rdf.type)).toBeUndefined();
        });

        it("returns the type for type statements", () => {
            const store = new RDFStore();
            store.addHextuples([
                rdfFactory.quad(ex("2"), rdf.type, ex("SomeClass")),
            ]);

            expect(store.getResourceProperty(ex("2"), rdf.type))
                .toEqual(ex("SomeClass"));
        });

        it("returns undefined for other statements on unloaded resources", () => {
            const store = new RDFStore();

            expect(store.getResourceProperty(ex("1"), ex("prop"))).toBeUndefined();
        });

        it("returns the object for other statements", () => {
            const store = new RDFStore();
            store.addHextuples([
                rdfFactory.quad(ex("2"), ex("prop"), rdfFactory.literal("some prop")),
            ]);

            expect(store.getResourceProperty(ex("2"), ex("prop")))
                .toEqual(rdfFactory.literal("some prop"));
        });

        it("picks the preferred language", () => {
            const store = new RDFStore();
            store.addHextuples([
                rdfFactory.quad(ex("2"), ex("prop"), rdfFactory.literal("some prop", "de")),
                rdfFactory.quad(ex("2"), ex("prop"), rdfFactory.literal("some prop", "nl")),
                rdfFactory.quad(ex("2"), ex("prop"), rdfFactory.literal("some prop", "en")),
                rdfFactory.quad(ex("2"), ex("prop"), rdfFactory.literal("some prop", "fr")),
            ]);

            expect(store.getResourceProperty(ex("2"), ex("prop")))
                .toEqual(rdfFactory.literal("some prop", "en"));
        });
    });

    describe("#processTypeStatement", () => {
        it("initializes new resources", () => {
            const store = new RDFStore();

            expect(store.typeCache[ex("1")]).toBeUndefined();
            store.addHextuples([
                rdfFactory.quad(ex("1"), rdf.type, ex("type"), ex("_")),
            ]);
            expect(store.typeCache[ex("1")]).toEqual([ex("type")]);
        });

        it("adds new types for cached resources", () => {
            const store = new RDFStore();
            store.addHextuples([
                rdfFactory.quad(ex("1"), rdf.type, ex("type"), ex("_")),
                rdfFactory.quad(ex("1"), rdf.type, ex("type2"), ex("_")),
            ]);

            expect(store.typeCache[ex("1")]).toEqual([ex("type"), ex("type2")]);
        });

        it("removes type statements after they are removed from the store", () => {
            const store = new RDFStore();
            store.addHextuples([
                rdfFactory.quad(ex("1"), rdf.type, ex("type"), ex("_")),
                rdfFactory.quad(ex("1"), rdf.type, ex("type2"), ex("_")),
            ]);
            store.removeHexes([rdfFactory.quad(ex("1"), rdf.type, ex("type"), ex("_"))]);
            store.flush();

            expect(store.typeCache[ex("1")]).toEqual([ex("type2")]);
        });
    });

    describe("#removeResource", () => {
        it("bumps the changeTimestamp", async () => {
            const store = getBasicStore();
            const resource = example("test");
            store.store.addHextuples([
                rdfFactory.quad(resource, rdf.type, schema.Person),
            ]);
            store.store.flush();
            const before = store.store.changeTimestamps[resource];

            await new Promise((resolve): void => { window.setTimeout(resolve, 100); });

            store.store.removeResource(resource);
            expect(store.store.changeTimestamps[resource]).toBeGreaterThan(before);
        });

        it("clears the type cache", () => {
            const store = getBasicStore();
            const resource = example("test");
            store.store.addHextuples([
                rdfFactory.quad(resource, rdf.type, schema.Person),
            ]);

            expect(store.store.typeCache[resource]).toHaveLength(1);
            store.store.removeResource(resource);
            expect(store.store.typeCache[resource]).toHaveLength(0);
        });

        it("removes the resource data", () => {
            const store = getBasicStore();
            const resource = example("test");
            store.store.addHextuples([
                rdfFactory.quad(resource, rdf.type, schema.Person),
                rdfFactory.quad(resource, schema.name, rdfFactory.literal("Name")),
                rdfFactory.quad(resource, schema.author, ex("3")),
                rdfFactory.quad(example("other"), schema.author, ex("3")),
            ]);

            expect(store.store.quadsFor(resource)).toHaveLength(3);
            store.store.removeResource(resource);
            expect(store.store.quadsFor(resource)).toHaveLength(0);
        });

        describe("owl:sameAs", () => {
            describe("big small", () => {
                it("equal before", () => {
                    const store = getBasicStore();
                    store.store.addHextuples(aboutIsThing);
                    store.store.addHextuples(thingStatements);

                    store.store.removeResource(schema.AboutPage);

                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(0);
                    expect(store.store.match(schemaT, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(0);
                });

                it("equal after", () => {
                    const store = getBasicStore();
                    store.store.addHextuples(thingStatements);
                    store.store.addHextuples(aboutIsThing);

                    store.store.removeResource(schemaT);

                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(0);
                    expect(store.store.match(schemaT, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(0);
                });
            });

            describe("small big", () => {
                it("equal before", () => {
                    const store = getBasicStore();
                    store.store.addHextuples(thingIsAbout);
                    store.store.addHextuples(thingStatements);

                    store.store.removeResource(schema.AboutPage);

                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(0);
                    expect(store.store.match(schemaT, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(0);
                });

                it("equal after", () => {
                    const store = getBasicStore();
                    store.store.addHextuples(thingStatements);
                    store.store.addHextuples(thingIsAbout);

                    store.store.removeResource(schemaT);

                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(0);
                    expect(store.store.match(schemaT, rdfs.label, rdfFactory.literal("Thing."), null))
                        .toHaveLength(0);
                });
            });
        });
    });

    describe("#workAvailable", () => {
        it("is zero without work", () => {
            expect(new RDFStore().workAvailable()).toEqual(0);
        });

        it("is more than zero work", () => {
            const store = new RDFStore();
            expect(store.workAvailable()).toEqual(0);
            store.addHextuples(thingStatements);
            expect(store.workAvailable()).toEqual(3);
        });

        it("is reset after #flush()", () => {
            const store = new RDFStore();
            store.addHextuples(thingStatements);
            expect(store.workAvailable()).toEqual(3);
            store.flush();
            expect(store.workAvailable()).toEqual(0);
        });
    });
});
