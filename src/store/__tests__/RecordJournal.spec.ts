import "../../__tests__/useFactory";

import rdfFactory from "@ontologies/core";

import { RecordJournal } from "../RecordJournal";
import { RecordState } from "../RecordState";
import { RecordStatus } from "../RecordStatus";

describe("RecordJournal", () => {
    it("sets the seed data on initialization", () => {
        const initial: Record<string, RecordStatus> = {
            "/resources/4": {
                current: RecordState.Present,
                lastUpdate: 0,
                previous: RecordState.Absent,
            },
        };
        const journal = new RecordJournal(jest.fn(), initial);

        expect((journal as any).data).toBe(initial);
    });

    it("does not journal local ids", () => {
        const journal = new RecordJournal(jest.fn());

        expect(journal.get(rdfFactory.blankNode().value)).toEqual({
            current: RecordState.Present,
            lastUpdate: -1,
            previous: RecordState.Present,
        });
    });

    it("copy accepts a new callback", () => {
        const callback = jest.fn();
        const callback2 = jest.fn();
        const journal = new RecordJournal(callback);

        expect((journal.copy() as any).onChange).toBe(callback);
        expect((journal.copy(callback2) as any).onChange).toBe(callback2);
    });
});
