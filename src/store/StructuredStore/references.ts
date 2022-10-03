import { TermType } from "@ontologies/core";

import { DataRecord, DataSlice, Id } from "../../datastrucures/DataSlice";
import { FieldValue } from "../../datastrucures/Fields";
import { idField } from "../StructuredStore";

export const fieldReferences = (values: FieldValue, referenced: Id): boolean => {
  if (Array.isArray(values)) {
    for (const value of values) {
      if (value.termType !== TermType.Literal && value.value === referenced) {
        return true;
      }
    }
  } else {
    if (values.termType !== TermType.Literal && values.value === referenced) {
      return true;
    }
  }

  return false;
};

export const hasReferenceTo = (record: DataRecord, referenced: Id): boolean => {
  for (const field in record) {
    if (!record.hasOwnProperty(field) || field === idField) {
      continue;
    }

    const values = record[field];
    if (fieldReferences(values, referenced)) {
      return true;
    }
  }

  return false;
};

export const findAllReferencingIds = (data: DataSlice, referenced: Id): Id[] => {
  const found = [];

  for (const id in data) {
    if (!data.hasOwnProperty(id)) {
      continue;
    }

    const record = data[id];
    if (hasReferenceTo(record, referenced)) {
      found.push(id);
    }
  }

  return found;
};
