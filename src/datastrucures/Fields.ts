import { SomeTerm } from "@ontologies/core";

export type FieldId = string;

export type MultimapTerm = SomeTerm[];

export type FieldValue = SomeTerm | MultimapTerm;
