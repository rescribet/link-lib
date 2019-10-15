import { Comparable, DataFactory, PlainFactory, TermType } from "@ontologies/core";
import xsd from "@ontologies/xsd";
import { murmur3 } from "murmurhash-js";

import { AnyRDFObject, BlankNode, Literal, NamedNode, Quad, RDFObjectBase } from "./rdf";

interface MemoizedHashFactoryInternals {
    memoizationMap: { [k: string]: AnyRDFObject };
    seedBase: number;
}

export interface IdentityFactory<IndexType> extends DataFactory {
    findById(id: IndexType): AnyRDFObject;
    id(obj: AnyRDFObject): number;
}

export interface DataFactoryArgs {
    bnIndex?: number;
    memoizationMap?: {};
    seedBase?: number;
}

/**
 * RDF DataFactory which stores every value once at most.
 *
 * This version uses hashing which might be more CPU consuming but has deterministic id creation.
 */
class MemoizedHashFactory extends PlainFactory implements IdentityFactory<number>, MemoizedHashFactoryInternals {
    public bnIndex: number;
    /**
     * The seed base is used as a modifiable base index.
     * We increase the number with a fixed amount per term type to generate different hashes for terms with the same
     * value but a different termType.
     */
    public seedBase: number;
    public memoizationMap: { [k: string]: BlankNode | NamedNode | Literal | Quad };

    constructor(opts: DataFactoryArgs = {}) {
        super();

        this.bnIndex = opts.bnIndex || 0;
        this.memoizationMap = opts.memoizationMap || {};
        this.seedBase = opts.seedBase || 0;
    }

    public blankNode(value: string): BlankNode {
        return {
            termType: TermType.BlankNode,
            value,
        };
    }

    public namedNode(value?: string): NamedNode {
        return {
            termType: TermType.NamedNode,
            value: value ? value : `${(this.bnIndex!!)++}`,
        };
    }

    public defaultGraph(): NamedNode {
        return this.namedNode("rdf:defaultGraph");
    }

    public literal(value: string, languageOrDatatype: string | NamedNode): Literal {
        const isLangString = typeof languageOrDatatype === "string";

        return {
            datatype: !isLangString
                ? (languageOrDatatype as NamedNode)
                : xsd.string,
            language: isLangString ? (languageOrDatatype as string) : undefined,
            termType: TermType.Literal,
            value,
        };
    }

    public quad(
        subject: NamedNode | BlankNode,
        predicate: NamedNode,
        object: BlankNode | NamedNode | Literal,
        graph?: NamedNode,
    ): Quad & RDFObjectBase {
        return {
            id: murmur3(
                (this.id(subject)
                    + this.id(predicate)
                    + this.id(object)
                    + (graph ? this.id(graph) : 0)
                ).toString(),
                this.seedBase + 3,
            ),
            termType: "Quad",

            // tslint:disable:object-literal-sort-keys
            subject,
            predicate,
            object,
            graph,
            // tslint:enable:object-literal-sort-keys
        };
    }

    public equals(
        a: Comparable,
        b: Comparable,
    ): boolean {
        if (!a || !b) {
            return a === b;
        }

        if (Array.isArray(a) && Array.isArray(b)) {
            return this.id(a[0]) === this.id(b[0])
                && this.id(a[1]) === this.id(b[1])
                && this.id(a[2]) === this.id(b[2])
                && this.id(a[3]) === this.id(b[3]);
        }

        return this.id(a) === this.id(b);
    }

    public findById(id: number | string): AnyRDFObject {
        return this.memoizationMap[id];
    }

    public id(term: AnyRDFObject): number {
        if (Array.isArray(term)) {
            return -1;
        }

        if (this.isQuad(term)) {
            return murmur3(
                (
                    this.id(term.subject)
                    + this.id(term.predicate)
                    + this.id(term.object)
                    + (term.graph ? this.id(term.graph) : 0)
                ).toString(),
                this.seedBase + 3,
            );
        }

        switch (term.termType) {
            case TermType.BlankNode:
                return murmur3(term.value, this.seedBase + 1);
            case TermType.NamedNode:
                return murmur3(term.value, this.seedBase + 2);
            case TermType.Literal: {
                const langOrDTId = term.language
                    ? murmur3(term.language, this.seedBase)
                    : this.id(term.datatype);

                return murmur3(term.value, this.seedBase + 4 + langOrDTId);
            }
            default:
                return -1;
        }
    }
}

export default new MemoizedHashFactory();
