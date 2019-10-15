import { QuadPosition } from "@ontologies/core";

import rdfFactory, {
    NamedNode,
    Node,
    Quadruple,
} from "../rdf";
import { Store } from "../rdflib";
import { StoreProcessor, StoreProcessorResult } from "../types";

const matchSingle = (graphIRI: NamedNode | undefined): (graph: Node) => boolean => {
    if (graphIRI) {
        const value = graphIRI.value;
        return (graph: Node): boolean => rdfFactory.equals(graph, graphIRI) || graph.value.startsWith(value);
    } else {
        return (graph: Node | undefined): boolean => graph === undefined;
    }
};

const isInGraph = (graphIRIS: Array<NamedNode | undefined>): (graph: Node) => boolean => {
    if (graphIRIS.length === 0) {
        return matchSingle(graphIRIS[0]);
    }
    const matchers = graphIRIS.map((iri) => matchSingle(iri));

    return (graph: Node): boolean => matchers.some((matcher) => matcher(graph));
};

export const deltaProcessor = (
    addGraphIRIS: Array<NamedNode | undefined>,
    replaceGraphIRIS: Array<NamedNode | undefined>,
    removeGraphIRIS: Array<NamedNode | undefined>,
    purgeGraphIRIS: Array<NamedNode | undefined>,
    sliceGraphIRIS: Array<NamedNode | undefined>,
): (store: Store) => StoreProcessor => {
    const isAdd = isInGraph(addGraphIRIS);
    const isReplace = isInGraph(replaceGraphIRIS);
    const isRemove = isInGraph(removeGraphIRIS);
    const isPurge = isInGraph(purgeGraphIRIS);
    const isSlice = isInGraph(sliceGraphIRIS);

    return (store: Store): StoreProcessor => (delta: Quadruple[]): StoreProcessorResult => {
        const addable = [];
        const replaceable = [];
        const removable = [];

        let quad: Quadruple;
        for (let i = 0, len = delta.length; i < len; i++) {
            quad = delta[i];

            if (!quad) {
                continue;
            }

            if (isAdd(quad[QuadPosition.graph])) {
                const g = new URL(quad[QuadPosition.graph].value).searchParams.get("graph");
                if (g) {
                    addable.push([
                        quad[QuadPosition.subject],
                        quad[QuadPosition.predicate],
                        quad[QuadPosition.object],
                        rdfFactory.namedNode(g),
                    ] as Quadruple);
                } else {
                    addable.push(quad);
                }
            } else if (isReplace(quad[QuadPosition.graph])) {
                const g = new URL(quad[QuadPosition.graph].value).searchParams.get("graph");
                if (g) {
                    replaceable.push([
                        quad[QuadPosition.subject],
                        quad[QuadPosition.predicate],
                        quad[QuadPosition.object],
                        rdfFactory.namedNode(g),
                    ] as Quadruple);
                } else {
                    replaceable.push(quad);
                }
            } else if (isRemove(quad[QuadPosition.graph])) {
                const g = new URL(quad[QuadPosition.graph].value).searchParams.get("graph");
                if (g) {
                    const matches = store.match(
                        quad[QuadPosition.subject],
                        quad[QuadPosition.predicate],
                        null,
                        rdfFactory.namedNode(g),
                    );
                    removable.push(...matches);
                } else {
                    const matches = store.match(
                        quad[QuadPosition.subject],
                        quad[QuadPosition.predicate],
                        null,
                        null,
                    );
                    removable.push(...matches);
                }
            } else if (isPurge(quad[QuadPosition.graph])) {
                const g = new URL(quad[QuadPosition.graph].value).searchParams.get("graph");
                if (g) {
                    const matches = store.match(
                        quad[QuadPosition.subject],
                        null,
                        null,
                        rdfFactory.namedNode(g),
                    );
                    removable.push(...matches);
                } else {
                    const matches = store.match(quad[QuadPosition.subject], null, null, null);
                    removable.push(...matches);
                }
            } else if (isSlice(quad[QuadPosition.graph])) {
                const g = new URL(quad[QuadPosition.graph].value).searchParams.get("graph");
                removable.push(...store.match(
                    quad[QuadPosition.subject],
                    quad[QuadPosition.predicate],
                    quad[QuadPosition.object],
                    g ? rdfFactory.namedNode(g) : null,
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
