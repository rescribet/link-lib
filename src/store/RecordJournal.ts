import { RecordState } from "./RecordState";
import { RecordStatus } from "./RecordStatus";
import { Id } from "./StructuredStore";

const doc = (recordId: Id): Id => {
    return recordId.split("#")[0];
};

const blankNodeStatus: RecordStatus = {
    current: RecordState.Present,
    lastUpdate: -1,
    previous: RecordState.Present,
};

const absentStatus: RecordStatus = {
    current: RecordState.Absent,
    lastUpdate: -1,
    previous: RecordState.Absent,
};

export class RecordJournal {
    private readonly data: Record<Id, RecordStatus> = {};

    constructor(data?: Record<Id, RecordStatus> | undefined) {
        if (data) {
            this.data = data;
        }
    }

    public copy(): RecordJournal {
        return new RecordJournal(JSON.parse(JSON.stringify(this.data)));
    }

    public get(recordId: Id): RecordStatus {
        if (!recordId.includes(":")) {
            return blankNodeStatus;
        }

        return this.data[doc(recordId)] ?? absentStatus;
    }

    public touch(recordId: Id): void {
        this.data[doc(recordId)].lastUpdate = Date.now();
    }

    public transition(recordId: Id, state: RecordState): void {
        const docId = doc(recordId);
        const existing = this.data[docId];
        const previous = existing !== undefined
            ? existing.current
            : RecordState.Absent;

        this.data[docId] = {
            current: state,
            lastUpdate: Date.now(),
            previous,
        };
    }
}
