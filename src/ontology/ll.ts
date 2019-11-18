import { createNS } from "../rdf";

const ll = createNS("http://purl.org/link-lib/");

export default {
    ns: ll,

    defaultTopology: ll("defaultTopology"),
    graph: ll("graph"),
    meta: ll("meta"),
    nop: ll("nop"),
    targetResource: ll("targetResource"),
    typeRenderClass: ll("typeRenderClass"),

    /** @deprecated */
    add: ll("add"),
    /** @deprecated */
    purge: ll("purge"),
    /** @deprecated */
    remove: ll("remove"),
    /** @deprecated */
    replace: ll("replace"),
    /** @deprecated */
    slice: ll("slice"),
};
