import rdf, { NamedNode, QuadPosition } from "@ontologies/core";
import * as rdfx from "@ontologies/rdf";

import { LinkedRenderStore } from "../LinkedRenderStore";
import { isGlobalId } from "../utilities/slices";

import { Messages } from "./message";

export type MessageProcessor = (m: Messages) => void;

export const createMessageProcessor = (lrs: LinkedRenderStore<unknown>): ((m: Messages) => void) => {
  const store = lrs.store.getInternalStore().store;

  return (message: Messages): void => {
    switch (message.type) {
    case "SetRecord": {
      store.setRecord(message.id, message.fields);
      break;
    }

    case "AddField":
    case "SetField": {
      const isPartial = isGlobalId(message.id)
        && message.field !== rdfx.type.value
        && !store.getField(message.id, rdfx.type.value);

      if (isPartial) {
        lrs.queueEntity(rdf.namedNode(message.id), { reload: true });
      } else if (message.type === "AddField") {
        store.addField(
          message.id,
          message.field,
          message.value,
        );
      } else if (message.type === "SetField") {
        store.setField(
          message.id,
          message.field,
          message.value,
        );
      }

      break;
    }

    case "DeleteField": {
      store.deleteField(message.id, message.field);
      break;
    }

    case "DeleteFieldMatching": {
      store.deleteFieldMatching(
        message.id,
        message.field,
        message.value,
      );
      break;
    }

    case "DeleteAllFieldsMatching": {
      const matches = lrs.store.match(
        null,
        rdf.namedNode(message.field),
        message.value,
      );

      for (const match of matches) {
        store.deleteFieldMatching(
          match[0].value,
          message.field,
          message.value,
        );
      }

      break;
    }

    case "InvalidateRecord": {
      if (isGlobalId(message.id)) {
        lrs.queueEntity(rdf.namedNode(message.id), { reload: true });
      }

      break;
    }

    case "InvalidateAllWithProperty": {
      const matches = lrs.store.match(
        null,
        rdf.namedNode(message.field),
        message.value,
      );

      for (const match of matches) {
        const id = match[QuadPosition.subject];

        if (isGlobalId(id.value)) {
          lrs.queueEntity(id as NamedNode, { reload: true });
        }
      }

      break;
    }

    default: {
      const error = new Error(`Unknown message: ${JSON.stringify(message)}`);
      lrs.report(error);
      throw error;
    }
    }
  };
};
