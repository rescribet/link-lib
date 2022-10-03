import { SomeNode } from "../types";

import { FieldValue } from "./Fields";

export type Id = string;

export type FieldSet = Record<string, FieldValue>;

export type DataRecord = { _id: SomeNode } & FieldSet;

export type DataSlice = Record<Id, DataRecord>;
