import {
    BlankNode as BasicBlankNode,
    createNS as basicCreateNS,
    Literal as BasicLiteral,
    NamedNode as BasicNamedNode,
    NamespaceCreator,
    Node as BasicNode,
    Quad as BasicQuad,
    Quadruple as BasicQuadruple,
    RDFObject,
    Term as BasicTerm,
} from "@ontologies/core";
import { memoizedHashFactory } from "./memoizedHashFactory";

export interface RDFObjectBase extends RDFObject {
    id: number;
}

export type AnyRDFObject = BlankNode | NamedNode | Node | Literal | Quad | Quadruple | Term;

export type BlankNode<T = RDFObjectBase> = BasicBlankNode<T>;

export type NamedNode<T = RDFObjectBase> = BasicNamedNode<T>;

export type Node<T = RDFObjectBase> = BasicNode<T>;

export type OptionalNode<T = RDFObjectBase> = Node<T> | undefined | null;

export type Literal<T = RDFObjectBase> = BasicLiteral<T>;

export type Quad<T = RDFObjectBase> = BasicQuad<T>;

export type Quadruple<T = RDFObjectBase> = BasicQuadruple<T>;

export type Term<T = RDFObjectBase> = BasicTerm<T>;

export const createNS = basicCreateNS as NamespaceCreator<RDFObjectBase>;

export default memoizedHashFactory;
