import { RecordState } from "./RecordState";

export interface RecordStatus {
    lastUpdate: number;
    current: RecordState;
    previous: RecordState;
}
