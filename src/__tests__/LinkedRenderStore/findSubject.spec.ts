import rdfFactory from "@ontologies/core";
import rdf from "@ontologies/rdf";
import schema from "@ontologies/schema";

import { getBasicStore } from "../../testUtilities";

import { ex } from "./fixtures";

describe("LinkedRenderStore", () => {
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
