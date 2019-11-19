import rdfFactory, { Quad, SomeTerm } from "@ontologies/core";
import rdf from "@ontologies/rdf";

import { LinkedRenderStore } from "../LinkedRenderStore";
import { SomeNode } from "../types";

/**
 * Convert a list from the point of {listEntry} to a Quad[].
 *
 * Will stop if missing links in the list aren't present. Can handle circular lists.
 */
export function orderedElementsOfList(store: LinkedRenderStore<any>, listEntry: SomeNode): Quad[] {
    const list = [];
    const nodes = [listEntry];
    let next: SomeNode | undefined = listEntry;
    while (next && next !== rdf.nil) {
        const item = store.getResourcePropertyRaw(next, rdf.first)[0];
        if (!item) {
            break;
        }
        list.push(item);
        next = store.getResourceProperty(next, rdf.rest);
        if (!next || nodes.includes(next)) {
            break;
        }
        nodes.push(next);
    }

    return list;
}

/**
 * Convert a list to an array of terms
 *
 * @see {arrayToList}
 */
export function listToArray(store: LinkedRenderStore<any>, listEntry: SomeNode): SomeTerm[] {
    return orderedElementsOfList(store, listEntry).map((s) => s.object);
}

/** Retrieve the first quad of the list at {listEntry} */
export function firstQuadOfList(store: LinkedRenderStore<any>, listEntry: SomeNode): Quad | undefined {
    return orderedElementsOfList(store, listEntry).shift();
}

/** Retrieve the first term of the list at {listEntry} */
export function firstTermOfList(store: LinkedRenderStore<any>, listEntry: SomeNode): SomeTerm | undefined {
    return firstQuadOfList(store, listEntry)?.object;
}

/** Retrieve the last quad of the list at {listEntry} */
export function lastQuadOfList(store: LinkedRenderStore<any>, listEntry: SomeNode): Quad | undefined {
    return orderedElementsOfList(store, listEntry).pop();
}

/** Retrieve the last term of the list at {listEntry} */
export function lastTermOfList(store: LinkedRenderStore<any>, listEntry: SomeNode): SomeTerm | undefined {
    return lastQuadOfList(store, listEntry)?.object;
}

/**
 * Convert an array of terms to a rdf:list.
 *
 * The quads are ordered, so `arrayToList()[0]?.subject` gives the list iri or undefined for an
 * empty list.
 *
 * @see {listToArray} for the inverse function.
 * @see {arrayToList}
 *
 * @param arr The array to convert.
 * @param [start] The iri of the first node in the list, defaults to a blank node.
 */
export function arrayToListQuads(arr: SomeTerm[], start: SomeNode | undefined): Quad[] {
    if (arr.length === 0) {
        return [];
    }

    const quads = [];
    let item = start || rdfFactory.blankNode();
    for (let i = 0; i < arr.length; i++) {
        const next = i === arr.length - 1 ? rdf.nil : rdfFactory.blankNode();
        quads.push(rdfFactory.quad(item, rdf.first, arr[i]), rdfFactory.quad(item, rdf.rest, next));
        item = next;
    }

    return quads;
}
/**
 * Convert an array of terms to a rdf:List.
 *
 * The quads are ordered, so `arrayToList()[0]?.subject` gives the list iri or undefined for an
 * empty list.
 *
 * @see {listToArray} for the inverse function.
 * @see {arrayToListQuads}
 *
 * @param arr The array to convert.
 * @param [start] The iri of the first node in the list, defaults to a blank node.
 * @return An array with the first element the quads and the second the IRI of the list.
 */
export function arrayToList(arr: SomeTerm[], start: SomeNode | undefined): [Quad[], SomeNode] {
    const quads = arrayToListQuads(arr, start);
    if (quads.length === 0) {
        return [quads, rdf.nil];
    }
    return [quads, quads[0].subject];
}
