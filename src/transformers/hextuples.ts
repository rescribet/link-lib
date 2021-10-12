import { Quad } from "@ontologies/core";

import { LinkedRenderStore } from "../LinkedRenderStore";
import {
  ResponseAndFallbacks,
  ResponseTransformer,
} from "../types";
import { hextupleTransformer } from "../utilities/hextupleProcessor";

export const hextupleProcessor = {
  acceptValue: 1.0,
  mediaTypes: ["application/hex+x-ndjson"],

  transformer: (store: LinkedRenderStore<any>): ResponseTransformer => (res: ResponseAndFallbacks): Promise<Quad[]> => {
    const isExpedited = res.hasOwnProperty("expedite")
      ? (res as any).expedite
      : false;

    return hextupleTransformer(res)
      .then((delta) => store.queueDelta(delta, isExpedited))
      .then(() => []);
  },
};
