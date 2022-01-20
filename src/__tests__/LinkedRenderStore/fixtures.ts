import rdfFactory, { createNS, NamedNode, Quadruple } from "@ontologies/core";
import * as dcterms from "@ontologies/dcterms";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schema from "@ontologies/schema";

import { RENDER_CLASS_NAME } from "../../ComponentStore/ComponentStore";
import { DEFAULT_TOPOLOGY } from "../../utilities/constants";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();

export const DT = rdfFactory.id(DEFAULT_TOPOLOGY);
export const RCN = rdfFactory.id(RENDER_CLASS_NAME);

export const schemaT = schema.Thing;
export const thingStatements: Quadruple[] = [
    [schemaT, rdf.type, rdfs.Class, defaultGraph],
    [schemaT, rdfs.comment, rdfFactory.literal("The most generic type of item."), defaultGraph],
    [schemaT, rdfs.label, rdfFactory.literal("Thing."), defaultGraph],
];

export const schemaCW = schema.CreativeWork;
export const creativeWorkStatements: Quadruple[] = [
    [schemaCW, rdf.type, rdfs.Class, defaultGraph],
    [schemaCW, rdfs.label, rdfFactory.literal("CreativeWork"), defaultGraph],
    [schemaCW, rdfs.subClassOf, schemaT, defaultGraph],
    [
        schemaCW,
        dcterms.source,
        rdfFactory.namedNode("http://www.w3.org/wiki/WebSchemas/SchemaDotOrgSources#source_rNews"),
        defaultGraph,
    ],
    [
        schemaCW,
        rdfs.comment,
        rdfFactory.literal("The most generic kind of creative work, including books, movies, [...], etc."),
        defaultGraph,
    ],
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
