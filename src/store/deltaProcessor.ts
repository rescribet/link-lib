import rdfFactory, {
  LowLevelStore,
  NamedNode,
  Node,
  Quad,
  QuadPosition,
  Quadruple,
} from "@ontologies/core";

import { equals } from "../factoryHelpers";
import { StoreProcessor, StoreProcessorResult } from "../types";

const matchSingle = (graphIRI: NamedNode): (graph: Node) => boolean => {
    const value = graphIRI.value;
    return (graph: Node): boolean => equals(graph, graphIRI) || graph.value.startsWith(value);
};

const isInGraph = (graphIRIS: NamedNode[]): (graph: Node) => boolean => {
    if (graphIRIS.length === 0) {
        throw new Error("Pass a default graph explicitly");
    }
    const matchers = graphIRIS.map((iri) => matchSingle(iri));

    return (graph: Node): boolean => matchers.some((matcher) => matcher(graph));
};

const pushQuadruple = (arr: Quadruple[], quadruple: Quadruple, graph: NamedNode): void => {
    arr.push([
        quadruple[QuadPosition.subject],
        quadruple[QuadPosition.predicate],
        quadruple[QuadPosition.object],
        graph,
    ]);
};

export const deltaProcessor = (
    addGraphIRIS: NamedNode[],
    replaceGraphIRIS: NamedNode[],
    removeGraphIRIS: NamedNode[],
    purgeGraphIRIS: NamedNode[],
    sliceGraphIRIS: NamedNode[],
): (store: LowLevelStore) => StoreProcessor => {
    const defaultGraph = rdfFactory.defaultGraph();

    const isAdd = isInGraph(addGraphIRIS);
    const isReplace = isInGraph(replaceGraphIRIS);
    const isRemove = isInGraph(removeGraphIRIS);
    const isPurge = isInGraph(purgeGraphIRIS);
    const isSlice = isInGraph(sliceGraphIRIS);

    return (store: LowLevelStore): StoreProcessor => (delta: Quadruple[]): StoreProcessorResult => {
        const addable: Quadruple[] = [];
        const replaceable: Quadruple[] = [];
        const removable: Quad[] = [];

        let quad: Quadruple;
        for (let i = 0, len = delta.length; i < len; i++) {
            quad = delta[i];

            if (!quad) {
                continue;
            }

            const g = new URL(quad[QuadPosition.graph].value).searchParams.get("graph");
            const graph = g ? rdfFactory.termFromNQ(g) : defaultGraph;
            if (isAdd(quad[QuadPosition.graph])) {
                pushQuadruple(addable, quad, graph);
            } else if (isReplace(quad[QuadPosition.graph])) {
                pushQuadruple(replaceable, quad, graph);
            } else if (isRemove(quad[QuadPosition.graph])) {
                removable.push(...store.match(
                    quad[QuadPosition.subject],
                    quad[QuadPosition.predicate],
                    null,
                    graph,
                ));
            } else if (isPurge(quad[QuadPosition.graph])) {
                removable.push(...store.match(
                    quad[QuadPosition.subject],
                    null,
                    null,
                    graph,
                ));
            } else if (isSlice(quad[QuadPosition.graph])) {
                removable.push(...store.match(
                    quad[QuadPosition.subject],
                    quad[QuadPosition.predicate],
                    quad[QuadPosition.object],
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
