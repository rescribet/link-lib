import { ErrorResponse, ResponseAndFallbacks } from "../types";

import {
    F_JSONLD,
    F_N3,
    F_NTRIPLES,
    F_NTRIPLES_DEP,
    F_PLAIN,
    F_RDF_XML,
    F_TURTLE,
    F_TURTLE_DEP,
    NON_CONTENT_EXTS,
} from "./constants";

/**
 * Extracts the content type from a request.
 * The content-type value has precedence if it contains a known type.
 * Otherwise it returns the extension if present, or the content-type without the encoding.
 *
 * @summary Extracts the content type from a request.
 */
export function getContentType(res: ResponseAndFallbacks): string {
    const contentTypeRaw = getHeader(res, "Content-Type");
    if (contentTypeRaw === undefined || contentTypeRaw === null) {
        return "";
    }
    const contentType: string = contentTypeRaw.split(";")[0];
    const url = getURL(res);
    const urlMatch = url && new URL(url).href.match(/\.([a-zA-Z0-9]{1,8})($|\?|#)/);
    const ext = urlMatch ? urlMatch[1] : "";
    if (contentType) {
        const matched = contentTypeByMimeString(contentType, ext);
        if (matched) {
            return matched;
        }
    }
    if (ext && !NON_CONTENT_EXTS.includes(ext)) {
        return contentTypeByExtention(ext);
    }

    return contentTypeRaw.split(";")[0];
}

export async function getJSON(res: ResponseAndFallbacks): Promise<object | ErrorResponse> {
    if (res instanceof Response) {
        return res.json();
    } else if (res instanceof XMLHttpRequest) {
        return JSON.parse(res.responseText);
    }

    return JSON.parse(res.body);
}

export function getHeader(res: ResponseAndFallbacks, header: string): string | null {
    if (res instanceof Response) {
        return res.headers.get(header);
    } else if (res instanceof XMLHttpRequest) {
        return res.getResponseHeader(header) || null;
    } else if (res && res.headers) {
        const headerValue = res.headers[header];
        return headerValue || null;
    }

    return null;
}

export function getURL(res: ResponseAndFallbacks): string {
    if (res instanceof XMLHttpRequest) {
        return res.responseURL;
    } else if ("requestedURI" in res) {
        return res.requestedURI;
    }

    return res.url;
}

export function contentTypeByExtention(ext: string): string {
    if (["ttl"].includes(ext)) {
        return F_TURTLE;
    } else if (["ntriples", "nt"].includes(ext)) {
        return F_NTRIPLES;
    } else if (["jsonld"].includes(ext)) {
        return F_JSONLD;
    } else if (["n3"].includes(ext)) {
        return F_N3;
    }

    return ext;
}

export function contentTypeByMimeString(contentType: string, ext: string): string | undefined {
    if (contentType.includes(F_NTRIPLES) || contentType.includes(F_NTRIPLES_DEP)) {
        return F_NTRIPLES;
    } else if (contentType.includes(F_PLAIN) && ["ntriples", "nt"].indexOf(ext) >= 0) {
        return F_NTRIPLES;
    } else if (contentType.includes(F_TURTLE) || contentType.includes(F_TURTLE_DEP)) {
        return F_TURTLE;
    } else if (contentType.includes(F_N3)) {
        return F_N3;
    } else if (contentType.includes(F_JSONLD)) {
        return F_JSONLD;
    } else if (contentType.includes(F_RDF_XML)) {
        return F_RDF_XML;
    }

    return undefined;
}
