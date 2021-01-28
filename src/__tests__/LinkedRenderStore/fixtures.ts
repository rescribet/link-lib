import rdfFactory from "@ontologies/core";
import * as dcterms from "@ontologies/dcterms";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";

import { RENDER_CLASS_NAME } from "../../ComponentStore";
import { createNS } from "../../rdf";
import { DEFAULT_TOPOLOGY } from "../../utilities/constants";

export const DT = rdfFactory.id(DEFAULT_TOPOLOGY);
export const RCN = rdfFactory.id(RENDER_CLASS_NAME);

export const schemaT = schema.Thing;
export const thingStatements = [
    rdfFactory.quad(schemaT, rdf.type, rdfs.Class),
    rdfFactory.quad(schemaT, rdfs.comment, rdfFactory.literal("The most generic type of item.")),
    rdfFactory.quad(schemaT, rdfs.label, rdfFactory.literal("Thing.")),
];

export const schemaCW = schema.CreativeWork;
export const creativeWorkStatements = [
    rdfFactory.quad(schemaCW, rdf.type, rdfs.Class),
    rdfFactory.quad(schemaCW, rdfs.label, rdfFactory.literal("CreativeWork")),
    rdfFactory.quad(schemaCW, rdfs.subClassOf, schemaT),
    rdfFactory.quad(
        schemaCW,
        dcterms.source,
        rdfFactory.namedNode("http://www.w3.org/wiki/WebSchemas/SchemaDotOrgSources#source_rNews"),
    ),
    rdfFactory.quad(
        schemaCW,
        rdfs.comment,
        rdfFactory.literal("The most generic kind of creative work, including books, movies, [...], etc."),
    ),
];

export const example = createNS("http://example.com/");
export const ex = createNS("http://example.com/ns#");
export const ldNS = createNS("http://purl.org/linked-delta/");
export const ld = {
    add: ldNS("add"),
    purge: ldNS("purge"),
    remove: ldNS("remove"),
    replace: ldNS("replace"),
    slice: ldNS("slice"),
    supplant: ldNS("supplant"),
};
