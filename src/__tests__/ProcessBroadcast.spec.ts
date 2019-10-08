import "./useHashFactory";

import rdfFactory from "@ontologies/core";
import "jest";

import { ProcessBroadcast, ProcessBroadcastOpts } from "../ProcessBroadcast";
import { Quad } from "../rdf";
import { SubscriptionRegistrationBase } from "../types";
import { defaultNS as NS} from "../utilities/constants";

const schemaT = NS.schema("Thing");
// const resource1 = NS.ex("1");
const resource2 = NS.ex("2");
const resource3 = NS.ex("3");
const resource4 = NS.ex("4");
const resource5 = NS.ex("5");
const resource6 = NS.ex("6");

const mixedWork = [
    rdfFactory.quad(resource5, NS.ex("prop"), NS.ex("unknown"), NS.example("why")),
    rdfFactory.quad(schemaT, NS.rdf("type"), NS.rdfs("Class"), NS.example("why")),
    rdfFactory.quad(schemaT, NS.rdf("label"), rdfFactory.literal("A class"), NS.example("why")),
    rdfFactory.quad(resource2, NS.schema("name"), rdfFactory.literal("resource 1"), NS.example("why")),
    rdfFactory.quad(resource2, NS.schema("name"), rdfFactory.literal("resource 2"), NS.example("why")),
    rdfFactory.quad(resource3, NS.rdf("label"), rdfFactory.literal("D. Adams"), NS.example("why")),
    rdfFactory.quad(resource4, NS.schema("name"), rdfFactory.literal("Resource Name"), NS.example("why")),
    rdfFactory.quad(resource4, NS.schema("text"), rdfFactory.literal("Resource text"), NS.example("why")),
    rdfFactory.quad(resource4, NS.schema("author"), resource3, NS.example("why")),
    rdfFactory.quad(
        resource6,
        NS.schema("text"),
        rdfFactory.literal("Should contain only deleted regs"),
        NS.example("why"),
    ),
];

const getOpts = (
    work: Quad[] = [],
    bulkSubscriptions: Array<SubscriptionRegistrationBase<unknown>> = [],
    subjectSubscriptions: Array<SubscriptionRegistrationBase<unknown>> = [],
): ProcessBroadcastOpts => ({
    bulkSubscriptions,
    changedSubjects: work.reduce(
        (acc, cur) => acc.includes(rdfFactory.id(cur.subject)) ? acc : acc.concat(rdfFactory.id(cur.subject)),
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
                rdfFactory.quad(schemaT, NS.rdf("type"), NS.rdfs("Class"), NS.example("why")),
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
