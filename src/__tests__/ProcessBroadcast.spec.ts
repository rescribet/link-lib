import "jest";
import { Literal, Statement } from "rdflib";

import { ProcessBroadcast, ProcessBroadcastOpts } from "../ProcessBroadcast";
import { SomeNode, SubscriptionRegistrationBase } from "../types";
import { defaultNS as NS} from "../utilities/constants";

const schemaT = NS.schema("Thing");
const resource1 = NS.ex("1");
const resource2 = NS.ex("2");
const resource3 = NS.ex("3");
const resource4 = NS.ex("4");
const resource5 = NS.ex("5");
const resource6 = NS.ex("6");

const mixedWork = [
    new Statement(resource5, NS.ex("prop"), NS.ex("unknown"), NS.example("why")),
    new Statement(schemaT, NS.rdf("type"), NS.rdfs("Class"), NS.example("why")),
    new Statement(schemaT, NS.rdf("label"), new Literal("A class"), NS.example("why")),
    new Statement(resource2, NS.schema("name"), new Literal("resource 1"), NS.example("why")),
    new Statement(resource2, NS.schema("name"), new Literal("resource 2"), NS.example("why")),
    new Statement(resource3, NS.rdf("label"), new Literal("D. Adams"), NS.example("why")),
    new Statement(resource4, NS.schema("name"), new Literal("Resource Name"), NS.example("why")),
    new Statement(resource4, NS.schema("text"), new Literal("Resource text"), NS.example("why")),
    new Statement(resource4, NS.schema("author"), resource3, NS.example("why")),
    new Statement(resource6, NS.schema("text"), new Literal("Should contain only deleted regs"), NS.example("why")),
];

const getOpts = (
    work: Statement[] = [],
    bulkSubscriptions: Array<SubscriptionRegistrationBase<unknown>> = [],
    subjectSubscriptions: Map<SomeNode, Array<SubscriptionRegistrationBase<unknown>>> = new Map(),
): ProcessBroadcastOpts => ({
    bulkSubscriptions,
    subjectSubscriptions,
    timeout: 10,
    work,
});

describe("ProcessBroadcast", () => {
    describe("without subscribers", () => {
        describe("and no work", () => {
            const processor = new ProcessBroadcast(getOpts());

            it("has not bulk processors", () => expect(processor.bulkLength).toBe(0));
            it("has no subject processors", () => expect(processor.subjectLength).toBe(0));
            it("is done", () => expect(processor.done()).toBeTruthy());
        });

        describe("and work", () => {
            const processor = new ProcessBroadcast(getOpts([
                new Statement(schemaT, NS.rdf("type"), NS.rdfs("Class"), NS.example("why")),
            ]));

            it("has not bulk processors", () => expect(processor.bulkLength).toBe(0));
            it("has no subject processors", () => expect(processor.subjectLength).toBe(0));
            it("is done", () => expect(processor.done()).toBeTruthy());
        });
    });

    describe("with bulk only", () => {
        describe("and no work", () => {
            const cb = jest.fn<ReadonlyArray<Statement>>();

            const processor = new ProcessBroadcast(getOpts(
                [],
                [
                    { callback: cb, markedForDelete: false, onlySubjects: false },
                ],
            ));

            it("has bulk processors", () => expect(processor.bulkLength).toBe(1));
            it("has no subject processors", () => expect(processor.subjectLength).toBe(0));
            it("is done", () => expect(processor.done()).toBeTruthy());
            it("skips the processors", () => expect(cb).not.toHaveBeenCalled());
        });

        describe("with bulk subject combination", () => {
            describe("and work", () => {
                const bulk1 = jest.fn<ReadonlyArray<Statement>>();
                const bulk2 = jest.fn<ReadonlyArray<Statement>>();

                const processor = new ProcessBroadcast(getOpts(
                    mixedWork,
                    [
                        { callback: bulk1, markedForDelete: false, onlySubjects: false },
                        { callback: bulk2, markedForDelete: false, onlySubjects: false },
                    ],
                ));

                it("has no bulk processors", () => expect(processor.bulkLength).toBe(2));
                it("has subject processors", () => expect(processor.subjectLength).toBe(0));
                it("is done", () => expect(processor.done()).toBeFalsy());
                it("skips the processors on setup", () => {
                    expect(bulk1).not.toHaveBeenCalled();
                    expect(bulk2).not.toHaveBeenCalled();
                });

                it("calls the processors on run", async () => {
                    await processor.run();

                    expect(bulk1).toHaveBeenCalledTimes(1);
                    expect(bulk2).toHaveBeenCalledTimes(1);
                });

                it("is done after run", async () => {
                    await processor.run();
                    expect(processor.done()).toBeTruthy();
                });
            });
        });
    });

    describe("with subjects only", () => {
        describe("and no work", () => {
            const cb = jest.fn<ReadonlyArray<Statement>>();

            const processor = new ProcessBroadcast(getOpts(
                [],
                [],
                new Map<SomeNode, Array<SubscriptionRegistrationBase<unknown>>>([
                    [schemaT, [{ callback: cb, markedForDelete: false, onlySubjects: true }]],
                ]),
            ));

            it("has no bulk processors", () => expect(processor.bulkLength).toBe(0));
            it("has subject processors", () => expect(processor.subjectLength).toBe(1));
            it("is done", () => expect(processor.done()).toBeTruthy());
            it("skips the processors", () => expect(cb).not.toHaveBeenCalled());
        });

        describe("and work", () => {
            const st = jest.fn<ReadonlyArray<Statement>>();
            const stb = jest.fn<ReadonlyArray<Statement>>();
            const r1 = jest.fn<ReadonlyArray<Statement>>();
            const r2 = jest.fn<ReadonlyArray<Statement>>();
            const r4a = jest.fn<ReadonlyArray<Statement>>();
            const r4b = jest.fn<ReadonlyArray<Statement>>();
            const r5 = jest.fn<ReadonlyArray<Statement>>();

            const processor = new ProcessBroadcast(getOpts(
                mixedWork,
                [],
                new Map<SomeNode, Array<SubscriptionRegistrationBase<unknown>>>([
                    [schemaT, [
                        { callback: st, markedForDelete: false, onlySubjects: true },
                        { callback: stb, markedForDelete: false, onlySubjects: true },
                    ]],
                    [resource1, [{ callback: r1, markedForDelete: false, onlySubjects: true }]],
                    [resource2, [{ callback: r2, markedForDelete: false, onlySubjects: true }]],
                    [resource4, [
                        { callback: r4a, markedForDelete: false, onlySubjects: true },
                        { callback: r4b, markedForDelete: false, onlySubjects: true },
                    ]],
                    [resource5, [{ callback: r5, markedForDelete: false, onlySubjects: true }]],
                ]),
            ));

            it("has no bulk processors", () => expect(processor.bulkLength).toBe(0));
            it("has subject processors", () => expect(processor.subjectLength).toBe(5));
            it("is done", () => expect(processor.done()).toBeFalsy());
            it("skips the processors on setup", () => {
                expect(st).not.toHaveBeenCalled();
                expect(stb).not.toHaveBeenCalled();
                expect(r1).not.toHaveBeenCalled();
                expect(r2).not.toHaveBeenCalled();
                expect(r4a).not.toHaveBeenCalled();
                expect(r4b).not.toHaveBeenCalled();
                expect(r5).not.toHaveBeenCalled();
            });

            it("calls the processors on run", async () => {
                await processor.run();

                expect(st).toHaveBeenCalledTimes(1);
                expect(stb).toHaveBeenCalledTimes(1);
                expect(r1).not.toHaveBeenCalled();
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

    describe("with bulk subject combination", () => {
        describe("and work", () => {
            const bulk1 = jest.fn<ReadonlyArray<Statement>>();
            const bulk2 = jest.fn<ReadonlyArray<Statement>>();

            const st = jest.fn<ReadonlyArray<Statement>>();
            const stb = jest.fn<ReadonlyArray<Statement>>();
            const r1 = jest.fn<ReadonlyArray<Statement>>();
            const r2 = jest.fn<ReadonlyArray<Statement>>();
            const r4a = jest.fn<ReadonlyArray<Statement>>();
            const r4b = jest.fn<ReadonlyArray<Statement>>();
            const r5 = jest.fn<ReadonlyArray<Statement>>();
            const r6 = jest.fn<ReadonlyArray<Statement>>();

            const processor = new ProcessBroadcast(getOpts(
                mixedWork,
                [
                    { callback: bulk1, markedForDelete: false, onlySubjects: false },
                    { callback: bulk2, markedForDelete: false, onlySubjects: false },
                ],
                new Map<SomeNode, Array<SubscriptionRegistrationBase<unknown>>>([
                    [schemaT, [
                        { callback: st, markedForDelete: false, onlySubjects: true },
                        { callback: stb, markedForDelete: false, onlySubjects: true },
                    ]],
                    [resource1, [{ callback: r1, markedForDelete: false, onlySubjects: true }]],
                    [resource2, [{ callback: r2, markedForDelete: false, onlySubjects: true }]],
                    [resource4, [
                        { callback: r4a, markedForDelete: false, onlySubjects: true },
                        { callback: r4b, markedForDelete: false, onlySubjects: true },
                    ]],
                    [resource5, [{ callback: r5, markedForDelete: false, onlySubjects: true }]],
                    [resource6, [{ callback: r6, markedForDelete: true, onlySubjects: true }]],
                ]),
            ));

            it("has no bulk processors", () => expect(processor.bulkLength).toBe(2));
            it("has subject processors", () => expect(processor.subjectLength).toBe(6));
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
                expect(r1).not.toHaveBeenCalled();
                expect(r2).toHaveBeenCalledTimes(1);
                expect(r4a).toHaveBeenCalledTimes(1);
                expect(r4b).toHaveBeenCalledTimes(1);
                expect(r5).toHaveBeenCalledTimes(1);
                expect(r6).not.toHaveBeenCalled();
            });

            it("is done after run", async () => {
                await processor.run();
                expect(processor.done()).toBeTruthy();
            });
        });
    });
});