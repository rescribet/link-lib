import { SomeTerm } from "@ontologies/core";
import { FieldSet } from "../datastrucures/DataSlice";

export type Messages = SetRecordMessage
  | SetFieldMessage
  | AddFieldMessage
  | DeleteFieldMessage
  | DeleteFieldMatchingMessage
  | DeleteAllFieldsMatchingMessage
  | InvalidateRecordMessage
  | InvalidateAllWithPropertyMessage;

export interface IdMessage {
  id: string;
}

export interface FieldMessage {
  field: string;
}

export interface FieldSetMessage {
  fields: FieldSet;
}

export interface ValueMessage {
  value: SomeTerm;
}

export interface Message {
  type: string;
}

export interface SetRecordMessage extends Message, IdMessage, FieldSetMessage {
  type: "SetRecord";
  id: string;
  fields: FieldSet;
}

export interface SetFieldMessage extends Message, IdMessage, FieldMessage, ValueMessage {
  type: "SetField";
  id: string;
  field: string;
  value: SomeTerm;
}

export interface AddFieldMessage extends Message, IdMessage, FieldMessage, ValueMessage {
  type: "AddField";
  id: string;
  field: string;
  value: SomeTerm;
}

export interface DeleteFieldMessage extends Message, IdMessage, FieldMessage {
  type: "DeleteField";
  id: string;
  field: string;
}

export interface DeleteFieldMatchingMessage extends Message, IdMessage, FieldMessage, ValueMessage {
  type: "DeleteFieldMatching";
  id: string;
  field: string;
  value: SomeTerm;
}

export interface DeleteAllFieldsMatchingMessage extends Message, FieldMessage, ValueMessage {
  type: "DeleteAllFieldsMatching";
  field: string;
  value: SomeTerm;
}

export interface InvalidateRecordMessage extends Message {
  type: "InvalidateRecord";
  id: string;
}

export interface InvalidateAllWithPropertyMessage extends Message, FieldMessage, ValueMessage {
  type: "InvalidateAllWithProperty";
  field: string;
  value: SomeTerm;
}

/* tslint:disable object-literal-sort-keys */

export const setRecord = (id: string, fields: FieldSet): SetRecordMessage => ({
  type: "SetRecord",
  id,
  fields,
});

export const addField = (id: string, field: string, value: SomeTerm): AddFieldMessage => ({
  type: "AddField",
  id,
  field,
  value,
});

export const setField = (id: string, field: string, value: SomeTerm): SetFieldMessage => ({
  type: "SetField",
  id,
  field,
  value,
});

export const deleteAllFieldsMatching = (field: string, value: SomeTerm): DeleteAllFieldsMatchingMessage => ({
  type: "DeleteAllFieldsMatching",
  field,
  value,
});

export const deleteFieldMatching = (id: string, field: string, value: SomeTerm): DeleteFieldMatchingMessage => ({
  type: "DeleteFieldMatching",
  id,
  field,
  value,
});

export const deleteField = (id: string, field: string): DeleteFieldMessage => ({
  type: "DeleteField",
  id,
  field,
});

export const invalidateRecord = (id: string): InvalidateRecordMessage => ({
  type: "InvalidateRecord",
  id,
});

export const invalidateAllWithProperty = (field: string, value: SomeTerm): InvalidateAllWithPropertyMessage => ({
  type: "InvalidateAllWithProperty",
  field,
  value,
});

/* tslint:enable object-literal-sort-keys */
