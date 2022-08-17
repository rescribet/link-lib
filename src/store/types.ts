import { SomeTerm } from "@ontologies/core";
import { SomeNode } from "../types";

export type Id = string;
export type FieldId = string;
export type MultimapTerm = SomeTerm[];
export type FieldValue = SomeTerm | MultimapTerm;
export type FieldSet = Record<string, FieldValue>;
export type DataRecord = { _id: SomeNode } & FieldSet;
export type DeepRecordFieldValue = FieldValue | DeepRecord | Array<SomeTerm | DeepRecord>;
export type DeepRecord = { _id: SomeNode } & { [k: string]: DeepRecordFieldValue };
export type DataSlice = Record<Id, DataRecord>;
