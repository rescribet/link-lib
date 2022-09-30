import rdfFactory, { SomeTerm } from "@ontologies/core";
import { SomeNode } from "../types";
import { DataRecord, DataSlice } from "../store/types";

export interface RecordBuilder {
  /** Sets the {value} of {field} on the current record */
  field(field: string | SomeNode, value: SomeTerm): this;
  /** Returns the id of the current record. */
  id(): SomeNode;
}

export interface SliceBuilder {
  record(id?: string | SomeNode | undefined): RecordBuilder;
}

export type SliceCreator = (slice: SliceBuilder) => void;

export const buildSlice = (creator: SliceCreator): DataSlice => {
  if (creator === undefined) {
    throw new Error("No creator passed");
  }

  const slice: DataSlice = {};

  const builder: SliceBuilder = {
    record(id: string | SomeNode | undefined): RecordBuilder {
      const stringId = id === undefined
        ? rdfFactory.blankNode().value
        : (typeof id === "string" ? id : id.value);

      const termId = stringId.startsWith("_:")
        ? rdfFactory.blankNode(stringId)
        : rdfFactory.namedNode(stringId);

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
