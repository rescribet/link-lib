/* tslint:disable max-classes-per-file only-arrow-functions */

declare module "rdflib" {
    export interface BlankNodeIsh {
        termType: "BlankNode";
        value: string;
    }

    export interface LiteralIsh {
        datatype?: NamedNodeIsh;
        language?: string;
        termType: "Literal";
        value: string;
    }

    export interface NamedNodeIsh {
        termType: "NamedNode";
        value: string;
    }

    /**
     * Should return a truthy value to be kept as a callback.
     */
    export type RequestCallbackHandler = (uri: string | NamedNode, error?: Error) => boolean | undefined;

    export type TermIsh = NamedNodeIsh | BlankNodeIsh | LiteralIsh;
    export type StatementIsh = StatementLike | Statement;

    export interface StatementLike {
        graph: TermIsh | undefined;
        object: TermIsh;
        predicate: NamedNodeIsh;
        subject: NamedNodeIsh | BlankNodeIsh;
    }

    export type SomeTerm = NamedNode | BlankNode | Literal | Collection;

    export type ActionFunction = (formula: Formula,
                                  subj: NamedNode | BlankNode,
                                  pred: NamedNode,
                                  obj: SomeTerm,
                                  why: Node) => boolean;

    export abstract class Node {
        public static fromValue(value: string): Node;

        public readonly termType: string;
        public readonly value: string;

        public compareTerm(other: Node): number;

        public equals(other: Node): boolean;

        public hashString(): string;

        public sameTerm(other: Node): boolean;

        public toCanonical(): string;

        public toNT(): string;

        public toString(): string;
    }

    export class NamedNode extends Node {
        public readonly termType: "NamedNode";

        public sI: number;

        public term: string;

        public constructor(iri: NamedNode | string)

        public dir(): string;

        public doc(): NamedNode;

        public site(): NamedNode;
    }

    export class Literal extends Node {
        public static fromBoolean(value: boolean): Literal;

        public static fromDate(value: Date): Literal;

        public static fromNumber(value: number): Literal;

        public static fromValue(value: undefined | null | object | boolean | number | string): Literal;

        public readonly datatype: NamedNode;

        public language: string;

        public readonly termType: "Literal";

        public constructor(value: string | number, language?: string, datatype?: NamedNode | undefined)
    }

    export class BlankNode extends Node {
        public readonly termType: "BlankNode";

        public constructor(id?: string | null | undefined);
    }

    export class Collection extends Node {
        public readonly termType: "Collection";
    }

    export class DefaultGraph extends Node {
    }

    export interface FetcherOpts {
        fetch?: GlobalFetch["fetch"];
        timeout?: number;
    }

    export interface FetchOpts {
        fetch?: GlobalFetch["fetch"];
        referringTerm?: NamedNode;
        contentType?: string;
        forceContentType?: string;
        force?: boolean;
        baseURI?: Node | string;
        proxyUsed?: boolean;
        withCredentials?: boolean;
        clearPreviousData?: boolean;
        noMeta?: boolean;
        noRDFa?: boolean;
    }

    export type FetchSuccessCallback = (success: true, error: null, result: Response) => void;
    export type FetchFailureCallback = (success: false, error: string, result: undefined) => void;

    export class Fetcher {
        public mediatypes: { [k: string]: { [k: string]: number } };

        public constructor(store: Formula, options: FetcherOpts)

        public addCallback(hook: string, callback: RequestCallbackHandler): void;

        // tslint:disable-next-line no-any
        public fetch(url: NamedNode[] | string[] | NamedNode | string, options: FetchOpts): Promise<any>;

        public nowOrWhenFetched(uri: string | NamedNode,
                                options: RequestInit,
                                userCallback: FetchSuccessCallback | FetchFailureCallback): Promise<any>;
    }

    export class Formula extends Node {
        public statements: Statement[];

        public holdsStatement(st: Statement): boolean;
    }

    export class IndexedFormula extends Formula {

        public classActions: ActionFunction[];

        public features: string[];

        public index: Statement[][];

        public objectIndex: { [k: string]: Statement[] };

        public predicateIndex: { [k: string]: Statement[] };

        public propertyActions: { [k: string]: ActionFunction[] };

        public subjectIndex: { [k: string]: Statement[] };

        public whyIndex: { [k: string]: Statement[] };

        public add(subj: NamedNode | BlankNode, pred: NamedNode, obj: SomeTerm, why: Node): this | null | Statement;

        public add(subj: Statement | Statement[] | IndexedFormula | IndexedFormula[]): this;

        public addAll(statements: Statement[]): void;

        public canon(term: Node): Node;

        public match(subject: Node | string | TermIsh): Statement[];

        public newPropertyAction(pred: NamedNode, action: ActionFunction): boolean;

        public remove(st: Statement[] | Statement | IndexedFormula): this;

        public removeMany(sub: Node, pred: Node, obj: Node, why: Node, limit: number): void;

        public removeMatches(sub?: Node, pred?: Node, obj?: Node, why?: Node): this;

        public removeStatement(st: Statement): this;

        public removeStatements(st: Statement[]): this;

        public replaceWith(big: Node, small: Node): undefined | true;

        public statementsMatching(subj: Node | undefined,
                                  pred?: Node | undefined,
                                  obj?: Node | undefined,
                                  why?: Node | undefined,
                                  justOne?: boolean): Statement[];
    }

    export class Variable extends Node {
    }

    export class Statement {
        public object: SomeTerm;

        public predicate: NamedNode;

        public subject: NamedNode | BlankNode;

        public why: Node;

        public constructor(subject: NamedNode | BlankNode,
                           predicate: NamedNode,
                           object: SomeTerm,
                           why?: Node | string | undefined);

        public equals(other: Statement): boolean;

        public substitute(bindings: Statement): Statement;

        public toNT(): string;

        public toString(): string;
    }

    export type NamedNamespace = (ln: string) => NamedNode;

    export function Namespace(nsuri: string): (ln: string) => NamedNode;

    export function parse(str: string, kb: Formula, base: string, contentType: string, callback: () => void): void;

    /**
     * Data-factory functions
     */
    export function blankNode(value: string): BlankNode;

    export function collection(value: string): Collection;

    export function defaultGraph(value: string): DefaultGraph;

    export function fetcher(value: string): Fetcher;

    export function graph(): IndexedFormula;

    export function lit(val: string, lang: string, dt: NamedNode): Literal;

    export function literal(value: string, languageOrDatatype: string | NamedNode): Literal;

    export function namedNode(subject: Node, predicate: Node, object: Node): NamedNode;

    export function quad(subject: Node, predicate: Node, object: Node): Statement;

    export function st(subject: Node, predicate: Node, object: Node): Statement;

    export function triple(subject: Node, predicate: Node, object: Node): Statement;

    export function variable(subject: Node, predicate: Node, object: Node): Variable;
}
