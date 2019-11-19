import rdfFactory, { NamedNode, Node, Quad, SomeTerm } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";

import { LinkedRenderStore } from "../LinkedRenderStore";
import { SomeNode } from "../types";

/**
 * Parses the numerical value of a rdfs:ContainerMembershipProperty predicate.
 *
 * @see https://www.w3.org/TR/rdf-schema/#ch_containermembershipproperty
 * @return The value of the predicate or -1.
 */
export function seqMemberToNumber(member: NamedNode | undefined): number {
    return Number(member?.value?.split("_")?.pop() || -1);
}

export function orderedQuadsOfSeq(store: LinkedRenderStore<any>, seqIRI: Node): Quad[] {
    return store
        .getResourcePropertyRaw(seqIRI, rdfs.member)
        .sort((a, b) => seqMemberToNumber(a.predicate) - seqMemberToNumber(b.predicate));
}
/**
 * Convert a sequence to an array of terms
 *
 * @see {arrayToSeq}
 */
export function seqToArray(store: LinkedRenderStore<any>, seqIRI: Node): SomeTerm[] {
    return orderedQuadsOfSeq(store, seqIRI).map((s) => s.object);
}

/** Retrieve the first quad of the seq at {seqIRI} */
export function firstQuadOfSeq(store: LinkedRenderStore<any>, seqIRI: Node): Quad | undefined {
    return orderedQuadsOfSeq(store, seqIRI).shift();
}

/** Retrieve the first term of the seq at {seqIRI} */
export function firstTermOfSeq(store: LinkedRenderStore<any>, seqIRI: Node): SomeTerm | undefined {
    return firstQuadOfSeq(store, seqIRI)?.object;
}

/** Retrieve the last quad of the seq at {seqIRI} */
export function lastQuadOfSeq(store: LinkedRenderStore<any>, seqIRI: Node): Quad | undefined {
    return orderedQuadsOfSeq(store, seqIRI).pop();
}

/** Retrieve the last term of the seq at {seqIRI} */
export function lastTermOfSeq(store: LinkedRenderStore<any>, seqIRI: Node): SomeTerm | undefined {
    return lastQuadOfSeq(store, seqIRI)?.object;
}

/**
 * Convert an array of terms to a rdf:Seq.
 *
 * The quads are ordered, so `arrayToSeq()[0]?.subject` gives the seq iri or undefined for an
 * empty seq.
 *
 * @see {seqToArray} for the inverse function.
 * @see {arrayToSeq}
 *
 * @param arr The array to convert.
 * @param [iri] The iri of the seq, defaults to a blank node.
 */
export function arrayToSeqQuads(arr: SomeTerm[], iri?: SomeNode): Quad[] {
    if (arr.length === 0) {
        return [];
    }
    const seq = iri || rdfFactory.blankNode();
    const quads = [
        rdfFactory.quad(seq, rdf.type, rdf.Seq),
    ];
    for (let i = 0; i < arr.length; i++) {
        quads.push(rdfFactory.quad(seq, rdf.ns(`_${i}`), arr[i]));
    }
    return quads;
}

/**
 * Convert an array of terms to a rdf:Seq.
 *
 * @see {seqToArray} for the inverse function.
 * @see {arrayToSeqQuads}
 *
 * @param arr The array to convert.
 * @param [start] The iri of the first node in the seq, defaults to a blank node.
 * @return An array with the first element the quads and the second the IRI of the seq.
 */
export function arrayToSeq(arr: SomeTerm[], start?: SomeNode): [Quad[], SomeNode] {
    const quads = arrayToSeqQuads(arr, start);
    if (quads.length === 0) {
        return [quads, rdf.nil];
    }
    return [quads, quads[0].subject];
}
