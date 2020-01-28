import { createNS } from "@ontologies/core";

const http = createNS("http://www.w3.org/2007/ont/http#");

export default {
  ns: http,

  /* properties */
  status: http("status"),
  statusCode: http("statusCode"),
};
