import "jest";
import { BlankNode, IndexedFormula, Literal, Statement } from "rdflib";

import { getBasicStore } from "../../testUtilities";

import { defaultNS } from "../../utilities";
import {
    MSG_INCORRECT_TARGET,
    MSG_OBJECT_NOT_IRI,
    MSG_URL_UNDEFINED,
    MSG_URL_UNRESOLVABLE,
    ProcessorError,
} from "../ProcessorError";

describe("DataProcessor", () => {
    describe("#execActionByIRI", () => {
        it("throws an error when the action doesn't exists", async () => {
            const store = getBasicStore();

            const subject = defaultNS.example("actions/5");
            let error;
            try {
                await store.processor.execActionByIRI(subject, [new IndexedFormula(), []]);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_OBJECT_NOT_IRI);
        });

        it("throws an error when the target isn't a node", async () => {
            const store = getBasicStore();

            const subject = defaultNS.example("actions/5");
            store.store.addStatements([
                new Statement(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                new Statement(subject, defaultNS.schema("target"), new Literal("targets/5")),
            ]);

            let error;
            try {
                await store.processor.execActionByIRI(subject, [new IndexedFormula(), []]);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_INCORRECT_TARGET);
        });

        it("throws an error when the url is undefined", async () => {
            const store = getBasicStore();

            const subject = defaultNS.example("actions/5");
            store.store.addStatements([
                new Statement(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                new Statement(subject, defaultNS.schema("target"), defaultNS.example("targets/5")),
            ]);

            let error;
            try {
                await store.processor.execActionByIRI(subject, [new IndexedFormula(), []]);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_URL_UNDEFINED);
        });

        it("throws an error when the url is undefined", async () => {
            const store = getBasicStore();

            const subject = defaultNS.example("actions/5");
            store.store.addStatements([
                new Statement(subject, defaultNS.schema("object"), defaultNS.example("objects/1")),
                new Statement(subject, defaultNS.schema("target"), defaultNS.example("targets/5")),
                new Statement(defaultNS.example("targets/5"), defaultNS.schema("url"), new BlankNode()),
            ]);

            let error;
            try {
                await store.processor.execActionByIRI(subject, [new IndexedFormula(), []]);
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect((error as ProcessorError).message).toEqual(MSG_URL_UNRESOLVABLE);
        });
    });
});
