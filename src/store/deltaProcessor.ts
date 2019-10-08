import { IndexedFormula } from "rdflib";

import rdfFactory, {
    NamedNode,
    Node,
    Quadruple,
} from "../rdf";
import { StoreProcessor, StoreProcessorResult } from "../types";

const matchSingle = (graphIRI: NamedNode | undefined): (graph: Node) => boolean => {
    if (graphIRI) {
        const value = graphIRI.value;
        return (graph: Node): boolean => graph === graphIRI || graph.value.startsWith(value);
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
): (store: IndexedFormula) => StoreProcessor => {
    const isAdd = isInGraph(addGraphIRIS);
    const isReplace = isInGraph(replaceGraphIRIS);
    const isRemove = isInGraph(removeGraphIRIS);
    const isPurge = isInGraph(purgeGraphIRIS);
    const isSlice = isInGraph(sliceGraphIRIS);

    return (store: IndexedFormula): StoreProcessor => (delta: Quadruple[]): StoreProcessorResult => {
        const addable = [];
        const replaceable = [];
        const removable = [];

        let quad: Quadruple;
        for (let i = 0, len = delta.length; i < len; i++) {
            quad = delta[i];

            if (!quad) {
                continue;
            }

            if (isAdd(quad[3])) {
                const g = new URL(quad[3].value).searchParams.get("graph");
                if (g) {
                    addable.push([quad[0], quad[1], quad[2], rdfFactory.namedNode(g)] as Quadruple);
                } else {
                    addable.push(quad);
                }
            } else if (isReplace(quad[3])) {
                const g = new URL(quad[3].value).searchParams.get("graph");
                if (g) {
                    replaceable.push([quad[0], quad[1], quad[2], rdfFactory.namedNode(g)] as Quadruple);
                } else {
                    replaceable.push(quad);
                }
            } else if (isRemove(quad[3])) {
                const g = new URL(quad[3].value).searchParams.get("graph");
                if (g) {
                    const matches = store.match(quad[0], quad[1], null, rdfFactory.namedNode(g));
                    removable.push(...matches);
                } else {
                    const matches = store.match(quad[0], quad[1], null, null);
                    removable.push(...matches);
                }
            } else if (isPurge(quad[3])) {
                const g = new URL(quad[3].value).searchParams.get("graph");
                if (g) {
                    const matches = store.match(quad[0], null, null, rdfFactory.namedNode(g));
                    removable.push(...matches);
                } else {
                    const matches = store.match(quad[0], null, null, null);
                    removable.push(...matches);
                }
            } else if (isSlice(quad[3])) {
                const g = new URL(quad[3].value).searchParams.get("graph");
                if (g) {
                    removable.push(...store.match(quad[0], quad[1], quad[2], rdfFactory.namedNode(g)));
                } else {
                    removable.push(...store.match(quad[0], quad[1], quad[2], null));
                }
            }
        }

        return [
            addable,
            replaceable,
            removable,
        ];
    };
};
