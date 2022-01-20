import "./useHashFactory";

import rdfFactory, { QuadPosition, Quadruple } from "@ontologies/core";
import * as rdfx from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";
import "jest";

import ex from "../ontology/ex";
import example from "../ontology/example";
import { ProcessBroadcast, ProcessBroadcastOpts } from "../ProcessBroadcast";
import { SubscriptionRegistrationBase } from "../types";

const schemaT = schema.Thing;
// const resource1 = ex.ns("1");
const resource2 = ex.ns("2");
const resource3 = ex.ns("3");
const resource4 = ex.ns("4");
const resource5 = ex.ns("5");
const resource6 = ex.ns("6");

const mixedWork: Quadruple[] = [
    [resource5, ex.ns("prop"), ex.ns("unknown"), example.ns("why")],
    [schemaT, rdfx.type, rdfs.Class, example.ns("why")],
    [schemaT, rdfs.label, rdfFactory.literal("A class"), example.ns("why")],
    [resource2, schema.name, rdfFactory.literal("resource 1"), example.ns("why")],
    [resource2, schema.name, rdfFactory.literal("resource 2"), example.ns("why")],
    [resource3, rdfs.label, rdfFactory.literal("D. Adams"), example.ns("why")],
    [resource4, schema.name, rdfFactory.literal("Resource Name"), example.ns("why")],
    [resource4, schema.text, rdfFactory.literal("Resource text"), example.ns("why")],
    [resource4, schema.author, resource3, example.ns("why")],
    [
        resource6,
        schema.text,
        rdfFactory.literal("Should contain only deleted regs"),
        example.ns("why"),
    ],
];

const getOpts = (
    work: Quadruple[] = [],
    bulkSubscriptions: Array<SubscriptionRegistrationBase<unknown>> = [],
    subjectSubscriptions: Array<SubscriptionRegistrationBase<unknown>> = [],
): ProcessBroadcastOpts => ({
    bulkSubscriptions,
    changedSubjects: work.reduce(
        (acc, cur) => acc.includes(rdfFactory.id(cur[QuadPosition.subject]))
            ? acc
            : acc.concat(rdfFactory.id(cur[QuadPosition.subject])),
        [] as number[],
    ),
    subjectSubscriptions,
    timeout: 10,
    work,
});

describe("ProcessBroadcast", () => {
    describe("without subscribers", () => {
        describe("and no work", () => {
            const processor = new ProcessBroadcast(getOpts());

            it("is done", () => expect(processor.done()).toBeTruthy());
        });

        describe("and work", () => {
            const processor = new ProcessBroadcast(getOpts([
                [schemaT, rdfx.type, rdfs.Class, example.ns("why")],
            ]));

            it("is done", () => expect(processor.done()).toBeTruthy());
        });
    });

    describe("with bulk subject combination", () => {
        describe("and work", () => {
            const bulk1 = jest.fn<void, any[]>();
            const bulk2 = jest.fn<void, any[]>();

            const st = jest.fn<void, any[]>();
            const stb = jest.fn<void, any[]>();
            const r1 = jest.fn<void, any[]>();
            const r2 = jest.fn<void, any[]>();
            const r4a = jest.fn<void, any[]>();
            const r4b = jest.fn<void, any[]>();
            const r5 = jest.fn<void, any[]>();
            const r6 = jest.fn<void, any[]>();

            const processor = new ProcessBroadcast(getOpts(
                mixedWork,
                [
                    { callback: bulk1, markedForDelete: false, onlySubjects: false },
                    { callback: bulk2, markedForDelete: false, onlySubjects: false },
                ],
                [
                    // schemaT
                    { callback: st, markedForDelete: false, onlySubjects: true },
                    { callback: stb, markedForDelete: false, onlySubjects: true },
                    // resource1
                    { callback: r1, markedForDelete: false, onlySubjects: true },
                    // resource2
                    { callback: r2, markedForDelete: false, onlySubjects: true },
                    // resource4
                    { callback: r4a, markedForDelete: false, onlySubjects: true },
                    { callback: r4b, markedForDelete: false, onlySubjects: true },
                    // resource5
                    { callback: r5, markedForDelete: false, onlySubjects: true },
                    // resource6
                    { callback: r6, markedForDelete: true, onlySubjects: true },
                ],
            ));

            // it("has no bulk processors", () => expect(processor.bulkLength).toBe(2));
            // it("has subject processors", () => expect(processor.subjectLength).toBe(6));
            it("is done", () => expect(processor.done()).toBeFalsy());
            it("skips the processors on setup", () => {
                expect(bulk1).not.toHaveBeenCalled();
                expect(bulk2).not.toHaveBeenCalled();

                expect(st).not.toHaveBeenCalled();
                expect(stb).not.toHaveBeenCalled();
                expect(r1).not.toHaveBeenCalled();
                expect(r2).not.toHaveBeenCalled();
                expect(r4a).not.toHaveBeenCalled();
                expect(r4b).not.toHaveBeenCalled();
                expect(r5).not.toHaveBeenCalled();
                expect(r6).not.toHaveBeenCalled();
            });

            it("calls the processors on run", async () => {
                await processor.run();

                expect(bulk1).toHaveBeenCalledTimes(1);
                expect(bulk2).toHaveBeenCalledTimes(1);

                expect(st).toHaveBeenCalledTimes(1);
                expect(stb).toHaveBeenCalledTimes(1);
                expect(r2).toHaveBeenCalledTimes(1);
                expect(r4a).toHaveBeenCalledTimes(1);
                expect(r4b).toHaveBeenCalledTimes(1);
                expect(r5).toHaveBeenCalledTimes(1);
            });

            it("is done after run", async () => {
                await processor.run();
                expect(processor.done()).toBeTruthy();
            });
        });
    });
});
