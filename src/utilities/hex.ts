import rdfFactory, {
    BlankNode,
    HexPos,
    Hextuple,
    isBlankNode, isLiteral, isNamedNode,
    Literal,
    NamedNode,
    Quad, Quadruple, Resource,
} from "@ontologies/core";
import rdfx from "@ontologies/rdf";

const namedNode = "http://www.w3.org/1999/02/22-rdf-syntax-ns#namedNode";
const blankNode = "http://www.w3.org/1999/02/22-rdf-syntax-ns#blankNode";

export function termTypeOrder(obj: any): number {
    if (isNamedNode(obj)) {
        return 5;
    }
    if (isBlankNode(obj)) {
        return 6;
    }
    if (isLiteral(obj)) {
        return 1;
    }

    return 0;
}

export function objectToHexObj(obj: NamedNode | BlankNode | Literal): Literal;
export function objectToHexObj(obj: null): [null, null, null];
export function objectToHexObj(
    obj: NamedNode | BlankNode | Literal | null,
): Literal | [null, null, null] {
    if (obj === null) {
        return [null, null, null];
    }

    if (isLiteral(obj)) {
        return obj;
    } else if (isNamedNode(obj)) {
        return [
            obj,
            rdfx.ns("namedNode"),
            "",
        ];
    } else if (isBlankNode(obj)) {
        return [
            obj,
            rdfx.ns("blankNode"),
            "",
        ];
    } else {
        throw new Error(`Wrong object given, was ${obj}`);
    }
}

export function hexToQuad(q: Hextuple): Quad {
    return rdfFactory.quad(
        isBlankNode(q[HexPos.subject])
            ? rdfFactory.blankNode(q[HexPos.subject])
            : rdfFactory.namedNode(q[HexPos.subject]),
        rdfFactory.namedNode(q[HexPos.predicate]),
        rdfFactory.literal(q[HexPos.object], q[HexPos.objectLang] || q[HexPos.objectDT]),
        isBlankNode(q[HexPos.graph])
            ? rdfFactory.blankNode(q[HexPos.graph])
            : rdfFactory.namedNode(q[HexPos.graph]),
    );
}

export function quadToHex(q: Quad): Hextuple {
    return [
        q.subject,
        q.predicate,
        ...objectToHexObj(q.object),
        q.graph,
    ] as Hextuple;
}

export function quadrupleToHex(q: Quadruple): Hextuple {
    return [
        q[0],
        q[1],
        ...objectToHexObj(q[2]),
        q[3],
    ] as Hextuple;
}

export function literalFromHex(hex: Hextuple): Literal {
    return hex.slice(HexPos.object, HexPos.graph) as Literal;
}

export function literalFromResource(resource: Resource): Literal {
    return [
        resource,
        resource.startsWith("_:") ? blankNode : namedNode,
        "",
    ];
}
