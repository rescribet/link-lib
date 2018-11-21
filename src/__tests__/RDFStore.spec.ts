import "jest";
import {
    IndexedFormula,
    Literal,
    Statement,
} from "rdflib";

import { RDFStore } from "../RDFStore";
import { defaultNS as NS } from "../utilities/constants";

const schemaT = NS.schema("Thing");
const thingStatements = [
    new Statement(schemaT, NS.rdf("type"), NS.rdfs("Class"), NS.example("why")),
    new Statement(schemaT, NS.rdfs("comment"), new Literal("The most generic type of item."), NS.example("why")),
    new Statement(schemaT, NS.rdfs("label"), new Literal("Thing."), NS.example("why")),
];

describe("RDFStore", () => {
    describe("#addStatements", () => {
        it("works", () => {
            const store = new RDFStore();
            store.addStatements(thingStatements);

            const libStatements = store.getInternalStore().statements;
            expect(libStatements).toHaveLength(3);
            expect(libStatements[0]).toEqual(thingStatements[0]);
            expect(libStatements[1]).toEqual(thingStatements[1]);
            expect(libStatements[2]).toEqual(thingStatements[2]);
        });
    });

    describe("#flush", () => {
        it("is returns the work available", () => {
            const store = new RDFStore();
            store.addStatements(thingStatements);
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
            expect(new RDFStore().getInternalStore())
                .toBeInstanceOf(IndexedFormula);
        });
    });

    describe("#replaceMatches", () => {
        it("replaces a statement", () => {
            const store = new RDFStore();
            store.addStatements(thingStatements);

            const statements = [
                new Statement(schemaT, NS.rdfs("label"), new Literal("Thing!"), NS.ll("replace")),
            ];

            const before = store.match(schemaT, NS.rdfs("label"));
            expect(before).toHaveLength(1);
            expect(before[0].object).toEqual(new Literal("Thing."));

            store.replaceMatches(statements);

            const after = store.match(schemaT, NS.rdfs("label"));
            expect(after).toHaveLength(1);
            expect(after[0].object).toEqual(new Literal("Thing!", undefined, NS.xsd("string")));
        });
    });

    describe("#processDelta", () => {
        describe("ll:remove", () => {
            it("removes one", () => {
                const store = new RDFStore();
                store.addStatements(thingStatements);

                expect(store.match(null)).toHaveLength(thingStatements.length);

                const statements = [
                    new Statement(schemaT, NS.rdfs("label"), new Literal("irrelevant"), NS.ll("remove")),
                ];

                store.processDelta(statements);

                expect(store.match(null)).toHaveLength(thingStatements.length - 1);
                expect(store.match(schemaT, NS.rdfs("label"))).toHaveLength(0);
            });

            it("removes many", () => {
                const store = new RDFStore();
                store.addStatements(thingStatements);
                store.addStatements([new Statement(schemaT, NS.rdfs("label"), new Literal("Thing gb", "en-gb"))]);

                expect(store.match(null)).toHaveLength(thingStatements.length + 1);

                const statements = [
                    new Statement(schemaT, NS.rdfs("label"), new Literal("irrelevant"), NS.ll("remove")),
                ];

                store.processDelta(statements);

                expect(store.match(null)).toHaveLength(thingStatements.length - 1);
                expect(store.match(schemaT, NS.rdfs("label"))).toHaveLength(0);
            });
        });
    });

    // describe("#replaceStatements", () => {
    //     it("works", () => {
    //         const expected = undefined;
    //         expect(new RDFStore().replaceStatements())
    //             .toEqual(expected);
    //     });
    // });
    //
    // describe("#getResourcePropertyRaw", () => {
    //     it("works", () => {
    //         const expected = undefined;
    //         expect(new RDFStore().getResourcePropertyRaw())
    //             .toEqual(expected);
    //     });
    // });
    //
    // describe("#getResourceProperties", () => {
    //     it("works", () => {
    //         const expected = undefined;
    //         expect(new RDFStore().getResourceProperties())
    //             .toEqual(expected);
    //     });
    // });
    //
    // describe("#getResourceProperty", () => {
    //     it("works", () => {
    //         const expected = undefined;
    //         expect(new RDFStore().getResourceProperty())
    //             .toEqual(expected);
    //     });
    // });
    //
    // describe("#statementsFor", () => {
    //     it("works", () => {
    //         const expected = undefined;
    //         expect(new RDFStore().statementsFor())
    //             .toEqual(expected);
    //     });
    // });

    describe("#processTypeStatement", () => {
        it("initializes new resources", () => {
            const store = new RDFStore();

            // @ts-ignore TS-2341
            expect(store.typeCache[NS.ex("1").toString()]).toBeUndefined();
            store.addStatements([
                new Statement(NS.ex("1"), NS.rdf("type"), NS.ex("type"), NS.ex("_")),
            ]);
            // @ts-ignore TS-2341
            expect(store.typeCache[NS.ex("1").toString()]).toEqual([NS.ex("type")]);
        });

        it("adds new types for cached resources", () => {
            const store = new RDFStore();
            store.addStatements([
                new Statement(NS.ex("1"), NS.rdf("type"), NS.ex("type"), NS.ex("_")),
                new Statement(NS.ex("1"), NS.rdf("type"), NS.ex("type2"), NS.ex("_")),
            ]);

            // @ts-ignore TS-2341
            expect(store.typeCache[NS.ex("1").toString()]).toEqual([NS.ex("type"), NS.ex("type2")]);
        });

        it("removes type statements after they are removed from the store", () => {
            const store = new RDFStore();
            store.addStatements([
                new Statement(NS.ex("1"), NS.rdf("type"), NS.ex("type"), NS.ex("_")),
                new Statement(NS.ex("1"), NS.rdf("type"), NS.ex("type2"), NS.ex("_")),
            ]);
            store.removeStatements([new Statement(NS.ex("1"), NS.rdf("type"), NS.ex("type"), NS.ex("_"))]);
            store.flush();

            // @ts-ignore TS-2341
            expect(store.typeCache[NS.ex("1").toString()]).toEqual([NS.ex("type2")]);
        });
    });

    describe("#workAvailable", () => {
        it("is zero without work", () => {
            expect(new RDFStore().workAvailable()).toEqual(0);
        });

        it("is more than zero work", () => {
            const store = new RDFStore();
            expect(store.workAvailable()).toEqual(0);
            store.addStatements(thingStatements);
            expect(store.workAvailable()).toEqual(3);
        });

        it("is reset after #flush()", () => {
            const store = new RDFStore();
            store.addStatements(thingStatements);
            expect(store.workAvailable()).toEqual(3);
            store.flush();
            expect(store.workAvailable()).toEqual(0);
        });
    });
});
