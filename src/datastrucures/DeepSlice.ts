import { SomeTerm } from "@ontologies/core";

import { SomeNode } from "../types";

import { FieldValue } from "./Fields";

export type DeepRecordFieldValue = FieldValue | DeepRecord | Array<SomeTerm | DeepRecord>;

export type DeepRecord = { _id: SomeNode } & { [k: string]: DeepRecordFieldValue };
