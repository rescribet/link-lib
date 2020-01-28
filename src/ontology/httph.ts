import { createNS } from "@ontologies/core";

const httph = createNS("http://www.w3.org/2007/ont/httph#");

export default {
  "ns": httph,

  /* properties */
  "Exec-Action": httph("Exec-Action"),
  "date": httph("date"),
  "status": httph("status"),
};
