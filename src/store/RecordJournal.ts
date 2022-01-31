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

// tslint:disable member-ordering
export class RecordJournal {
    private readonly data: Record<Id, RecordStatus> = {};
    private readonly onChange: (docId: string) => void = () => undefined;

    constructor(onChange: (docId: string) => void, data?: Record<Id, RecordStatus> | undefined) {
        this.onChange = onChange;
        if (data) {
            this.data = data;
        }
    }

    public copy(onChange: ((docId: string) => void) | null = null): RecordJournal {
        return new RecordJournal(onChange ?? this.onChange, JSON.parse(JSON.stringify(this.data)));
    }

    public get(recordId: Id): RecordStatus {
        if (!recordId.includes(":")) {
            return blankNodeStatus;
        }

        return this.data[doc(recordId)] ?? absentStatus;
    }

    public touch(recordId: Id): void {
        const docId = doc(recordId);
        if (this.data[docId] === undefined) {
            this.data[docId] = {
                current: RecordState.Absent,
                lastUpdate: Date.now(),
                previous: RecordState.Absent,
            };
        } else {
            this.data[docId].lastUpdate = Date.now();
        }
        this.onChange(docId);
        this.onChange(recordId);
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
        this.onChange(docId);
        this.onChange(recordId);
    }
}