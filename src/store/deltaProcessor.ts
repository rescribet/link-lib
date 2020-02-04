import { HexPos, Hextuple, JSNamedNode, JSResource, LowLevelStore } from "@ontologies/core";

import rdfFactory from "../rdf";
import { StoreProcessor, StoreProcessorResult } from "../types";

const matchSingle = (graphIRI: JSNamedNode): (graph: JSResource) => boolean => {
    return (graph: JSResource): boolean => graph === graphIRI || graph.startsWith(graphIRI);
};

const isInGraph = (graphIRIS: JSNamedNode[]): (graph: JSResource) => boolean => {
    if (graphIRIS.length === 0) {
        throw new Error("Pass a default graph explicitly");
    }
    const matchers = graphIRIS.map((iri) => matchSingle(iri));

    return (graph: JSResource): boolean => matchers.some((matcher) => matcher(graph));
};

const pushHextuple = (arr: Hextuple[], quadruple: Hextuple, graph: JSResource): void => {
    arr.push([
        quadruple[HexPos.subject],
        quadruple[HexPos.predicate],
        quadruple[HexPos.object],
        quadruple[HexPos.objectDT],
        quadruple[HexPos.objectLang],
        graph,
    ]);
};

export const deltaProcessor = (
    addGraphIRIS: JSNamedNode[],
    replaceGraphIRIS: JSNamedNode[],
    removeGraphIRIS: JSNamedNode[],
    purgeGraphIRIS: JSNamedNode[],
    sliceGraphIRIS: JSNamedNode[],
): (store: LowLevelStore) => StoreProcessor => {
    const defaultGraph = rdfFactory.defaultGraph();

    const isAdd = isInGraph(addGraphIRIS);
    const isReplace = isInGraph(replaceGraphIRIS);
    const isRemove = isInGraph(removeGraphIRIS);
    const isPurge = isInGraph(purgeGraphIRIS);
    const isSlice = isInGraph(sliceGraphIRIS);

    return (store: LowLevelStore): StoreProcessor => (delta: Hextuple[]): StoreProcessorResult => {
        const addable: Hextuple[] = [];
        const replaceable: Hextuple[] = [];
        const removable: Hextuple[] = [];

        let quad: Hextuple;
        for (let i = 0, len = delta.length; i < len; i++) {
            quad = delta[i];

            if (!quad) {
                continue;
            }

            const searchIndex = quad[HexPos.graph].indexOf("?");
            const graph = searchIndex === -1
                ? defaultGraph
                : (new URLSearchParams(quad[HexPos.graph].substring(searchIndex)).get("graph") || defaultGraph);
            if (isAdd(quad[HexPos.graph])) {
                pushHextuple(addable, quad, graph);
            } else if (isReplace(quad[HexPos.graph])) {
                pushHextuple(replaceable, quad, graph);
            } else if (isRemove(quad[HexPos.graph])) {
                removable.push(...store.matchHex(
                    quad[HexPos.subject],
                    quad[HexPos.predicate],
                    null,
                    null,
                    null,
                    graph,
                ));
            } else if (isPurge(quad[HexPos.graph])) {
                removable.push(...store.matchHex(
                    quad[HexPos.subject],
                    null,
                    null,
                    null,
                    null,
                    graph,
                ));
            } else if (isSlice(quad[HexPos.graph])) {
                removable.push(...store.matchHex(
                    quad[HexPos.subject],
                    quad[HexPos.predicate],
                    quad[HexPos.object],
                    quad[HexPos.objectDT],
                    quad[HexPos.objectLang],
                    graph,
                ));
            }
        }

        return [
            addable,
            replaceable,
            removable,
        ];
    };
};
