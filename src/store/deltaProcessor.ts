import { LowLevelStore, QuadPosition } from "@ontologies/core";

import rdfFactory, {
    NamedNode,
    Node,
    Quad,
    Quadruple,
} from "../rdf";
import { StoreProcessor, StoreProcessorResult } from "../types";

const matchSingle = (graphIRI: NamedNode): (graph: Node) => boolean => {
    const value = graphIRI.value;
    return (graph: Node): boolean => rdfFactory.equals(graph, graphIRI) || graph.value.startsWith(value);
};

const isInGraph = (graphIRIS: NamedNode[]): (graph: Node) => boolean => {
    if (graphIRIS.length === 0) {
        throw new Error("Pass a default graph explicitly");
    }
    const matchers = graphIRIS.map((iri) => matchSingle(iri));

    return (graph: Node): boolean => matchers.some((matcher) => matcher(graph));
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
            if (isAdd(quad[QuadPosition.graph])) {
                addable.push([
                    quad[QuadPosition.subject],
                    quad[QuadPosition.predicate],
                    quad[QuadPosition.object],
                    g ? rdfFactory.termFromNQ(g) : defaultGraph,
                ]);
            } else if (isReplace(quad[QuadPosition.graph])) {
                replaceable.push([
                    quad[QuadPosition.subject],
                    quad[QuadPosition.predicate],
                    quad[QuadPosition.object],
                    g ? rdfFactory.termFromNQ(g) : defaultGraph,
                ]);
            } else if (isRemove(quad[QuadPosition.graph])) {
                const matches = store.match(
                    quad[QuadPosition.subject],
                    quad[QuadPosition.predicate],
                    null,
                    g ? rdfFactory.termFromNQ(g) : defaultGraph,
                );
                removable.push(...matches);
            } else if (isPurge(quad[QuadPosition.graph])) {
                const matches = store.match(
                    quad[QuadPosition.subject],
                    null,
                    null,
                    g ? rdfFactory.termFromNQ(g) : defaultGraph,
                );
                removable.push(...matches);
            } else if (isSlice(quad[QuadPosition.graph])) {
                removable.push(...store.match(
                    quad[QuadPosition.subject],
                    quad[QuadPosition.predicate],
                    quad[QuadPosition.object],
                    g ? rdfFactory.termFromNQ(g) : rdfFactory.defaultGraph(),
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
