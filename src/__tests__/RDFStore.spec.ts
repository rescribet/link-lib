import "jest";
import "./useFactory";

import rdfFactory, { createNS, NamedNode, QuadPosition, Quadruple } from "@ontologies/core";
import * as owl from "@ontologies/owl";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";
import * as xsd from "@ontologies/xsd";

import ll from "../ontology/ll";
import { RDFStore } from "../RDFStore";
import { RDFAdapter } from "../store/RDFAdapter";
import { getBasicStore } from "../testUtilities";

const example = createNS("http://example.com/");
const ex = createNS("http://example.com/ns#");

const defaultGraph: NamedNode = rdfFactory.defaultGraph();

const schemaT = schema.Thing;
const thingStatements: Quadruple[] = [
    [schemaT, rdf.type, rdfs.Class, defaultGraph],
    [schemaT, rdfs.comment, rdfFactory.literal("The most generic type"), defaultGraph],
    [schemaT, rdfs.label, rdfFactory.literal("Thing."), defaultGraph],
];
const aboutIsThing: Quadruple[] = [
    [schema.AboutPage, owl.sameAs, schemaT, defaultGraph],
];
const thingIsAbout: Quadruple[] = [
    [schemaT, owl.sameAs, schema.AboutPage, defaultGraph],
];

describe("RDFStore", () => {
    describe("#addQuads", () => {
        it("requires an array", () => {
            const store = new RDFStore();

            expect(() => {
                store.addQuads("test" as any);
            }).toThrowError(TypeError);
        });

        it("works", () => {
            const store = new RDFStore();
            store.addQuads(thingStatements);

            const libStatements = store.getInternalStore().quads;
            expect(libStatements).toHaveLength(3);
            expect(libStatements[0]).toEqual(thingStatements[0]);
            expect(libStatements[1]).toEqual(thingStatements[1]);
            expect(libStatements[2]).toEqual(thingStatements[2]);
        });

        describe("owl:sameAs", () => {
            describe("big small", () => {
                it("equates existing data", () => {
                    const store = getBasicStore();
                    store.store.addQuads(aboutIsThing);
                    store.store.addQuads(thingStatements);
                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(1);
                });

                it("equates new data", () => {
                    const store = getBasicStore();
                    store.store.addQuads(thingStatements);
                    store.store.addQuads(aboutIsThing);
                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(1);
                });
            });

            describe("small big", () => {
                it("equates existing data", () => {
                    const store = getBasicStore();
                    store.store.addQuads(thingIsAbout);
                    store.store.addQuads(thingStatements);
                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(1);
                });
            });
        });
    });

    describe("#flush", () => {
        it("is returns the work available", () => {
            const store = new RDFStore();
            store.addQuads(thingStatements);
            const res = store.flush();
            expect(res.has(schemaT.value)).toBeTruthy();
            expect(res.has(schema.AboutPage.value)).toBeFalsy();
        });

        it("is returns an empty set without work", () => {
            const res = new RDFStore().flush();
            expect(res.size).toEqual(0);
        });
    });

    describe("#getInternalStore", () => {
        it("returns the store", () => {
            expect(new RDFStore().getInternalStore()).toBeInstanceOf(RDFAdapter);
        });
    });

    describe("#replaceMatches", () => {
        it("replaces a statement", () => {
            const store = new RDFStore();
            store.addQuads(thingStatements);

            const quads: Quadruple[] = [
                [schemaT, rdfs.label, rdfFactory.literal("Thing!"), ll.ns("replace")],
            ];

            const before = store.match(schemaT, rdfs.label, null);
            expect(before).toHaveLength(1);
            expect(before[0][QuadPosition.object]).toEqual(rdfFactory.literal("Thing."));

            store.replaceMatches(quads);

            const after = store.match(schemaT, rdfs.label, null);
            expect(after).toHaveLength(1);
            expect(after[0][QuadPosition.object]).toEqual(rdfFactory.literal("Thing!", undefined, xsd.string));
        });
    });

    describe("#processDelta", () => {
        it("handles empty values", () => {
            const store = new RDFStore();

            expect(store.processDelta(new Array(1))).toEqual([]);
        });

        describe("ll:replace", () => {
            it("replaces existing", () => {
                const store = new RDFStore();

                expect(store.processDelta(new Array(1))).toEqual([]);
            });
        });

        describe("ll:remove", () => {
            it("removes one", () => {
                const store = new RDFStore();
                store.addQuads(thingStatements);

                expect(store.match(null, null, null)).toHaveLength(thingStatements.length);

                const statements: Quadruple[] = [
                    [schemaT, rdfs.label, rdfFactory.literal("irrelevant"), ll.ns("remove")],
                ];

                store.processDelta(statements);

                expect(store.match(null, null, null)).toHaveLength(thingStatements.length - 1);
                expect(store.match(schemaT, rdfs.label, null)).toHaveLength(0);
            });

            it("removes many", () => {
                const store = new RDFStore();
                store.addQuads(thingStatements);
                store.add(schemaT, rdfs.label, rdfFactory.literal("Thing gb", "en-gb"));

                expect(store.match(null, null, null)).toHaveLength(thingStatements.length + 1);

                const quads: Quadruple[] = [
                    [schemaT, rdfs.label, rdfFactory.literal("irrelevant"), ll.ns("remove")],
                ];

                store.processDelta(quads);

                expect(store.match(null, null, null)).toHaveLength(thingStatements.length - 1);
                expect(store.match(schemaT, rdfs.label, null)).toHaveLength(0);
            });
        });
    });

    describe("#getResourcePropertyRaw", () => {
        const store = new RDFStore();
        store.addQuads([
            [ex("a"), ex("p"), ex("x"), defaultGraph],
            [ex("a"), ex("r"), ex("y"), defaultGraph],

            [ex("b"), ex("p"), ex("xx"), defaultGraph],
            [ex("b"), ex("p"), ex("yy"), defaultGraph],
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
                    [ex("b"), ex("p"), ex("xx"), rdfFactory.namedNode("rdf:defaultGraph")],
                    [ex("b"), ex("p"), ex("yy"), rdfFactory.namedNode("rdf:defaultGraph")],
                ]);
        });

        it("resolves values for multiple properties one existent", () => {
            expect(store.getResourcePropertyRaw(ex("a"), [ex("p"), ex("q")]))
                .toEqual([
                    [ex("a"), ex("p"), ex("x"), rdfFactory.namedNode("rdf:defaultGraph")],
                ]);
        });

        it("resolves values for multiple properties multiple existent", () => {
            expect(store.getResourcePropertyRaw(ex("a"), [ex("r"), ex("p")]))
                .toEqual([
                  [ex("a"), ex("r"), ex("y"), rdfFactory.namedNode("rdf:defaultGraph")],
                  [ex("a"), ex("p"), ex("x"), rdfFactory.namedNode("rdf:defaultGraph")],
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
            store.addQuads([
                [ex("2"), rdf.type, ex("SomeClass"), rdfFactory.namedNode("rdf:defaultGraph")],
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
            store.addQuads([
                [ex("2"), ex("prop"), rdfFactory.literal("some prop"), defaultGraph],
            ]);

            expect(store.getResourceProperty(ex("2"), ex("prop")))
                .toEqual(rdfFactory.literal("some prop"));
        });

        it("picks the preferred language", () => {
            const store = new RDFStore();
            store.addQuads([
                [ex("2"), ex("prop"), rdfFactory.literal("some prop", "de"), defaultGraph],
                [ex("2"), ex("prop"), rdfFactory.literal("some prop", "nl"), defaultGraph],
                [ex("2"), ex("prop"), rdfFactory.literal("some prop", "en"), defaultGraph],
                [ex("2"), ex("prop"), rdfFactory.literal("some prop", "fr"), defaultGraph],
            ]);

            expect(store.getResourceProperty(ex("2"), ex("prop")))
                .toEqual(rdfFactory.literal("some prop", "en"));
        });
    });

    describe("#rdfFactory", () => {
        it("returns the @ontologies/core factory", () => {
            expect(new RDFStore().rdfFactory).toBe(rdfFactory);
        });

        it("throws setting the factory", () => {
            const store = new RDFStore();
            expect(() => {
                store.rdfFactory = {} as any;
            }).toThrow();
        });
    });

    describe("#removeResource", () => {
        it("removes the resource data", () => {
            const store = getBasicStore();
            const resource = example("test");
            store.store.addQuads([
                [resource, rdf.type, schema.Person, defaultGraph],
                [resource, schema.name, rdfFactory.literal("Name"), defaultGraph],
                [resource, schema.author, ex("3"), defaultGraph],
                [example("other"), schema.author, ex("3"), defaultGraph],
            ]);

            expect(store.store.quadsFor(resource)).toHaveLength(3);
            store.store.removeResource(resource);
            expect(store.store.quadsFor(resource)).toHaveLength(0);
        });

        describe("owl:sameAs", () => {
            describe("big small", () => {
                it("equal before", () => {
                    const store = getBasicStore();
                    store.store.addQuads(aboutIsThing);
                    store.store.addQuads(thingStatements);

                    store.store.removeResource(schema.AboutPage);

                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(0);
                    expect(store.store.match(schemaT, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(0);
                });

                it("equal after", () => {
                    const store = getBasicStore();
                    store.store.addQuads(thingStatements);
                    store.store.addQuads(aboutIsThing);

                    store.store.removeResource(schemaT);

                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(0);
                    expect(store.store.match(schemaT, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(0);
                });
            });

            describe("small big", () => {
                it("equal before", () => {
                    const store = getBasicStore();
                    store.store.addQuads(thingIsAbout);
                    store.store.addQuads(thingStatements);

                    store.store.removeResource(schema.AboutPage);

                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(0);
                    expect(store.store.match(schemaT, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(0);
                });

                it("equal after", () => {
                    const store = getBasicStore();
                    store.store.addQuads(thingStatements);
                    store.store.addQuads(thingIsAbout);

                    store.store.removeResource(schemaT);

                    expect(store.store.match(schema.AboutPage, rdfs.label, rdfFactory.literal("Thing.")))
                        .toHaveLength(0);
                    expect(store.store.match(schemaT, rdfs.label, rdfFactory.literal("Thing.")))
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
            store.addQuads([...thingStatements, ...aboutIsThing]);
            expect(store.workAvailable()).toEqual(2);
        });

        it("is reset after #flush()", () => {
            const store = new RDFStore();
            store.addQuads([...thingStatements, ...aboutIsThing]);
            expect(store.workAvailable()).toEqual(2);
            store.flush();
            expect(store.workAvailable()).toEqual(0);
        });
    });
});
