import { Quadruple } from "@ontologies/core";
import { hextuplesTransformer } from "hextuples";

import { LinkedRenderStore } from "../LinkedRenderStore";
import {
  ResponseAndFallbacks,
  ResponseTransformer,
} from "../types";

export const hextupleProcessor = {
  acceptValue: 1.0,
  mediaTypes: ["application/hex+x-ndjson"],

  transformer: (store: LinkedRenderStore<any>): ResponseTransformer =>
      (res: ResponseAndFallbacks): Promise<Quadruple[]> => {
    const isExpedited = res.hasOwnProperty("expedite")
      ? (res as any).expedite
      : false;

    return hextuplesTransformer(res)
      .then((delta) => store.queueDelta(delta, isExpedited))
      .then(() => []);
  },
};
