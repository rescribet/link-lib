import rdfFactory, { NamedNode, Quadruple } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as schema from "@ontologies/schema";

import { getBasicStore } from "../../testUtilities";

import { ex } from "./fixtures";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();

describe("LinkedRenderStore", () => {
    describe("#findSubject", () => {
        const store = getBasicStore();
        const bill = rdfFactory.literal("Bill");
        const bookTitle = rdfFactory.literal("His first work");
        const alternativeTitle = rdfFactory.literal("Some alternative title");
        const testData: Quadruple[] = [
            [ex("1"), rdf.type, ex("Organization"), defaultGraph],
            [ex("1"), schema.name, rdfFactory.literal("Some org"), defaultGraph],
            [ex("1"), schema.employee, ex("2"), defaultGraph],

            [ex("2"), rdf.type, schema.Person, defaultGraph],
            [ex("2"), schema.name, bill, defaultGraph],
            [ex("2"), schema.author, ex("3"), defaultGraph],
            [ex("2"), schema.author, ex("4"), defaultGraph],

            [ex("3"), rdf.type, schema.Book, defaultGraph],
            [ex("3"), schema.name, bookTitle, defaultGraph],
            [ex("3"), schema.name, alternativeTitle, defaultGraph],
            [ex("3"), schema.numberOfPages, rdfFactory.literal(75), defaultGraph],

            [ex("4"), rdf.type, schema.Book, defaultGraph],
            [ex("4"), schema.name, rdfFactory.literal("His second work"), defaultGraph],
            [ex("4"), schema.numberOfPages, rdfFactory.literal(475), defaultGraph],
            [ex("4"), schema.bookEdition, rdfFactory.literal("1st"), defaultGraph],
        ];
        store.store.addQuads(testData);

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
});
