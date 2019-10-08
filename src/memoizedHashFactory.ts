import {
    DataFactory,
    PlainFactory,
    Comparable,
} from "@ontologies/core";
import xsd from "@ontologies/xsd";
import { murmur3 } from "murmurhash-js";

import {
    AnyRDFObject,
    BlankNode,
    Literal,
    NamedNode,
    Quad,
    Quadruple,
    RDFObjectBase,
    Term,
} from "./rdf";

interface MemoizedHashFactoryInternals {
    memoizationMap: { [k: string]: AnyRDFObject };
    seedBase: number;
}

export interface IdentityFactory<T, IndexType> extends DataFactory<T> {
    findById(id: IndexType): AnyRDFObject;
}

/**
 * RDF DataFactory which stores every value once at most.
 *
 * This version uses hashing which might be more CPU consuming but has deterministic object creation.
 */
export const memoizedHashFactory: IdentityFactory<RDFObjectBase, number> & MemoizedHashFactoryInternals = {
    ...(PlainFactory as DataFactory<RDFObjectBase>),

    memoizationMap: {},

    /**
     * The seed base is used as a modifiable base index.
     * We increase the number with a fixed amount per term type to generate different hashes for terms with the same
     * value but a different termType.
     */
    seedBase: 0,

    blankNode(value: string): BlankNode {
        return {
            id: murmur3(value, this.seedBase + 1),
            termType: "BlankNode",
            value,
        };
    },

    namedNode(value: string): NamedNode {
        return {
            id: murmur3(value, this.seedBase + 2),
            termType: "NamedNode",
            value,
        };
    },

    defaultGraph(): NamedNode {
        return this.namedNode("rdf:defaultGraph");
    },

    literal(value: string, languageOrDatatype: string | NamedNode): Literal {
        const isLangString = typeof languageOrDatatype === "string";
        const langOrDTId = isLangString
            ? murmur3(languageOrDatatype as string, this.seedBase)
            : (languageOrDatatype as NamedNode).id;

        return {
            datatype: !isLangString
                ? (languageOrDatatype as NamedNode)
                : xsd.string,
            id: murmur3(value, this.seedBase + 4 + langOrDTId),
            language: isLangString ? (languageOrDatatype as string) : undefined,
            termType: "Literal",
            value,
        };
    },

    quad(subject: NamedNode | BlankNode, predicate: NamedNode, object: Term, graph?: NamedNode): Quad & RDFObjectBase {
        return {
            id: murmur3((subject.id + predicate.id + object.id + (graph ? graph.id : 0)).toString(), this.seedBase + 3),
            termType: "Quad",

            // tslint:disable:object-literal-sort-keys
            subject,
            predicate,
            object,
            graph,
            // tslint:enable:object-literal-sort-keys
        };
    },

    equals(
        a: Comparable<RDFObjectBase>,
        b: Comparable<RDFObjectBase>,
    ): boolean {
        const bothArray = Array.isArray(a) && Array.isArray(b);
        if (!bothArray) {
            return (a as RDFObjectBase).id === (b as RDFObjectBase).id;
        } else if (bothArray) {
            return (a as Quadruple)[0].id === (b as Quadruple)[0].id
                && (a as Quadruple)[1].id === (b as Quadruple)[1].id
                && (a as Quadruple)[2].id === (b as Quadruple)[2].id
                && (a as Quadruple)[3].id === (b as Quadruple)[3].id;
        } else {
            return false;
        }
    },

    findById(id: number): AnyRDFObject {
        return this.memoizationMap[id];
    },
};
