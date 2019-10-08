import rdfFactory, { DataFactory } from "@ontologies/core";
// @ts-ignore TS7016
import { Fetcher as RDFFetcher, IndexedFormula as RDFIndexedFormula, NamedNode as RDFNamedNode, parse as RDFparse,  Serializer as RDFSerializer, uri as RDFUri } from "rdflib"; // tslint:disable-line:max-line-length

import { NamedNode, OptionalNode, OptionalTerm, Quad, Term } from "./rdf";
import { SomeNode } from "./types";

/**
 * Store / IndexedFormula
 */

export type ActionFunction = (formula: Store,
                              subj: SomeNode,
                              pred: NamedNode,
                              obj: Term,
                              why: SomeNode) => boolean;

export interface Store {

    defaultGraphIRI: NamedNode;

    rdfFactory: DataFactory;

    statements: Quad[];

    length: number;

    subjectIndex: { [k: string]: Quad[] };

    whyIndex: { [k: string]: Quad[] };

    // tslint:disable-next-line:no-misused-new - This is required to extend from the export of this file.
    new (features?: string[],  opts?: { [k: string]: any }): Store;

    add(subj: SomeNode, pred: NamedNode, obj: Term, why?: SomeNode): this | null | Quad;

    add(subj: Quad | Quad[] | Store | Store[]): this;

    addAll(statements: Quad[]): void;

    addStatement(st: Quad): Quad | null;

    any(subj: OptionalNode,
        pred?: OptionalNode,
        obj?: OptionalTerm,
        why?: OptionalNode): Term | undefined;

    anyStatementMatching(subj: OptionalNode,
                         pred?: OptionalNode,
                         obj?: OptionalTerm,
                         why?: OptionalNode): Quad | undefined;

    anyValue(subj: OptionalNode,
             pred?: OptionalNode,
             obj?: OptionalTerm,
             why?: OptionalNode): string | undefined;

    canon(term: SomeNode): SomeNode;

    holdsStatement(st: Quad): boolean;

    match(subj: OptionalNode,
          pred?: OptionalNode,
          obj?: OptionalTerm,
          why?: OptionalNode): Quad[];

    newPropertyAction(pred: NamedNode, action: ActionFunction): boolean;

    remove(st: Quad[] | Quad | Store): this;

    removeMatches(sub?: SomeNode | null,
                  pred?: SomeNode | null,
                  obj?: OptionalTerm | null,
                  why?: SomeNode | null): this;

    removeStatement(st: Quad): this;

    removeStatements(st: Quad[]): this;

    statementsMatching(subj: SomeNode | undefined,
                       pred?: SomeNode | undefined,
                       obj?: OptionalTerm | undefined,
                       why?: SomeNode | undefined,
                       justOne?: boolean): Quad[];
}

export type GraphFactory = (features?: string[], opts?: { [k: string]: any }) => Store;

const convertedIndexedFormula = RDFIndexedFormula as unknown as Store;

const graph = ((features?: string[], opts?: { [k: string]: any }): Store =>
    new convertedIndexedFormula(features, opts || { rdfFactory })) as unknown as GraphFactory;

/**
 * Fetcher
 */

export interface RDFFetchOpts extends RequestInit {
    fetch?: WindowOrWorkerGlobalScope["fetch"];
    referringTerm?: NamedNode;
    contentType?: string;
    forceContentType?: string;
    force?: boolean;
    baseURI?: SomeNode | string;
    proxyUsed?: boolean;
    timeout?: number;
    withCredentials?: boolean;
    clearPreviousData?: boolean;
    noMeta?: boolean;
    noRDFa?: boolean;
}

export type RequestCallbackHandler = (uri: string | NamedNode, error?: Error) => boolean | undefined;
export type FetchSuccessCallback = (success: true, error: null, result: Response) => void;
export type FetchFailureCallback = (success: false, error: string, result: undefined) => void;

export interface Fetcher {
    mediatypes: { [k: string]: { [k: string]: number } };

    requested: { [k: string]: string | number | boolean };

    // tslint:disable-next-line:no-misused-new - This is required to extend from the export of this file.
    new (store: Store, options: RDFFetchOpts): Fetcher;

    addCallback(hook: string, callback: RequestCallbackHandler): void;

    handleError(response: Response, docuri: string | NamedNode, options: RequestInit): Promise<any>;

    // tslint:disable-next-line no-any
    load(url: NamedNode[] | string[] | NamedNode | string, options: RDFFetchOpts): Promise<any>;

    nowOrWhenFetched(uri: string | NamedNode,
                     options: RequestInit,
                     userCallback: FetchSuccessCallback | FetchFailureCallback): Promise<any>;
}

const convertedFetcher = RDFFetcher as unknown as Fetcher;

/**
 * Serializer
 */

export interface Serializer {
    flags: string;
    base: string | null;
    store: Store;

    // tslint:disable-next-line:no-misused-new - This is required to extend from the export of this file.
    new(store: Store): Serializer;

    fromStr(s: string): Store;

    setBase(base: string): this;

    setFlags(flags: string): this;

    toStr(): string;

    toN3(f: Store): string;

    statementsToNTriples(sts: Quad[]): string;

    statementsToN3(sts: Quad[]): string;

    statementsToXML(sts: Quad[]): string;

    stringToN3(str: string, flags: string): string;
}

const convertedSerializer = RDFSerializer as unknown as Serializer;

/**
 * NamedNode
 */

const siteImpl = RDFNamedNode.prototype.site as any;

const site = (node: NamedNode): NamedNode => rdfFactory.namedNode(siteImpl.call(node).value);

/**
 * Uri
 */

export interface Uri {
    docpart: (uri: string) => string;
    join: (given: string, base: string) => string;
}

const uri = RDFUri as Uri;

/**
 * Parse
 */

export type parse = (str: string, kb: Store, base: string, contentType: string, callback: () => void) => void;

const convertedParse = RDFparse as unknown as parse;

/**
 * Exports
 */

export {
    graph,
    convertedIndexedFormula as IndexedFormula,
    convertedFetcher as RDFFetcher,
    convertedSerializer as RDFSerializer,
    convertedParse as RDFparse,
    site,
    uri as URI,
};
