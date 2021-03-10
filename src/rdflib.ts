import { LowLevelStore, NamedNode } from "@ontologies/core";

import { SomeNode } from "./types";

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
    new (store: LowLevelStore, options: RDFFetchOpts): Fetcher;

    addCallback(hook: string, callback: RequestCallbackHandler): void;

    handleError(response: Response, docuri: string | NamedNode, options: RequestInit): Promise<any>;

    // tslint:disable-next-line no-any
    load(url: NamedNode[] | string[] | NamedNode | string, options: RDFFetchOpts): Promise<any>;

    nowOrWhenFetched(uri: string | NamedNode,
                     options: RequestInit,
                     userCallback: FetchSuccessCallback | FetchFailureCallback): Promise<any>;
}
