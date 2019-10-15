import {
    BlankNode as BasicBlankNode,
    createNS as basicCreateNS,
    Literal as BasicLiteral,
    NamedNode as BasicNamedNode,
    Node as BasicNode,
    Quad as BasicQuad,
    Quadruple as BasicQuadruple,
    RDFObject,
    Term as BasicTerm,
} from "@ontologies/core";
import MemoizedHashFactory from "./memoizedHashFactory";

export type RDFObjectBase = RDFObject;

export type AnyRDFObject = BlankNode | NamedNode | Literal | Quad | Quadruple;

export type BlankNode = BasicBlankNode;

export type NamedNode = BasicNamedNode;

export type Node = BasicNode;

export type OptionalNode = Node | undefined | null;

export type Literal = BasicLiteral;

export type Quad = BasicQuad;

export type Quadruple = BasicQuadruple;

export type Term = BasicTerm;

export const createNS = basicCreateNS;

export default MemoizedHashFactory;
