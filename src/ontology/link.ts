import { createNS } from "@ontologies/core";

const link = createNS("http://www.w3.org/2007/ont/link#");

export default {
    ns: link,

    Document: link("Document"),

    requestedURI: link("requestedURI"),
    response: link("response"),
};
