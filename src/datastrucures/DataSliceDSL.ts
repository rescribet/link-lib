import rdfFactory, { SomeTerm } from "@ontologies/core";
import { idToValue } from "../factoryHelpers";

import { SomeNode } from "../types";

import { DataRecord, DataSlice } from "./DataSlice";

export type OptionalIdOrNode = string | SomeNode | undefined;

export interface RecordBuilder {
  /** Sets the {value} of {field} on the current record */
  field(field: string | SomeNode, value: SomeTerm): this;
  /** Returns the id of the current record. */
  id(): SomeNode;
}

export interface SliceBuilder {
  record(id?: OptionalIdOrNode): RecordBuilder;
}

export type SliceCreator = (slice: SliceBuilder) => void;

const stringIdOrNewLocal = (id: OptionalIdOrNode): string => {
  if (id === undefined) {
    return rdfFactory.blankNode().value;
  }

  return typeof id === "string" ? id : id.value;
};

export const buildSlice = (creator: SliceCreator): DataSlice => {
  if (creator === undefined) {
    throw new Error("No creator passed");
  }

  const slice: DataSlice = {};

  const builder: SliceBuilder = {
    record(id: OptionalIdOrNode): RecordBuilder {
      const stringId = stringIdOrNewLocal(id);
      const termId = idToValue(stringId);

      const record: DataRecord = {
        _id: termId,
      };

      const recordBuilder: RecordBuilder = {
        field(field: string | SomeNode, value: SomeTerm): RecordBuilder {
          const fieldName = typeof field === "string" ? field : field.value;
          record[fieldName] = value;

          return recordBuilder;
        },

        id(): SomeNode {
          return termId;
        },
      };

      slice[stringId] = record;

      return recordBuilder;
    },
  };

  creator(builder);

  return slice;
};
