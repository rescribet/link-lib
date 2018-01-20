import "jest";
import {
    IndexedFormula,
    Literal,
    Statement,
} from "rdflib";

import { RDFStore } from "../RDFStore";
import { defaultNS as NS } from "../utilities";

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

    // describe("#removeStatements", () => {
    //     it("works", () => {
    //         const expected = undefined;
    //         expect(new RDFStore().removeStatements())
    //             .toEqual(expected);
    //     });
    // });
    //
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
