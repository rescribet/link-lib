import rdfFactory from "@ontologies/core";
import schema from "@ontologies/schema";

import { getBasicStore } from "../../testUtilities";
import { SubscriptionRegistrationBase } from "../../types";

import { schemaT } from "./fixtures";

describe("LinkedRenderStore", () => {
    describe("subscriptions", () => {
        describe("in bulk", () => {
            it("registers the subscription", async () => {
                const store = getBasicStore();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: false,
                };

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();
            });

            it("calls the subscription", async () => {
                const store = getBasicStore();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: false,
                };

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();

                await store.forceBroadcast();
                expect(callback).toHaveBeenCalled();
            });
        });

        describe("subject filtered", () => {
            it("registers the subscription", async () => {
                const store = getBasicStore();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: true,
                    subjectFilter: [schemaT],
                };

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();
            });

            it("skips the subscription when irrelevant", async () => {
                const store = getBasicStore();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: true,
                    subjectFilter: [schemaT],
                };

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();

                await store.forceBroadcast();
                expect(callback).not.toHaveBeenCalled();
            });

            it("calls the subscription when relevant", async () => {
                const store = getBasicStore();
                await store.forceBroadcast();
                const callback = jest.fn();
                const reg = {
                    callback,
                    markedForDelete: false,
                    onlySubjects: true,
                    subjectFilter: [schemaT],
                } as SubscriptionRegistrationBase<any>;

                store.lrs.subscribe(reg);
                expect(callback).not.toHaveBeenCalled();

                store.store.addHextuples([rdfFactory.quad(schemaT, schema.name, rdfFactory.literal("Thing"))]);
                await store.forceBroadcast();
                expect(callback).toHaveBeenCalledTimes(1);
                expect(callback.mock.calls[0][0]).toEqual([
                    schemaT,
                    store.store.defaultGraph(),
                ]);
                expect(callback.mock.calls[0][1]).toBeGreaterThanOrEqual(reg.subscribedAt!);
                expect(callback.mock.calls[0][1]).toBeLessThan(Date.now());
            });
        });
    });
});
