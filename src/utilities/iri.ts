import rdfFactory, { NamedNode } from "@ontologies/core";

/**
 * Get the IRI which the browser will fetch (the document).
 *
 * Effectively the IRI without the fragment.
 */
export function doc(iri: NamedNode): NamedNode {
    const url = new URL(iri.value);
    url.hash = "";

    return rdfFactory.namedNode(url.toString());
}

/**
 * Get the origin of the {iri} without trailing slash
 */
export function origin(iri: NamedNode): NamedNode {
    return rdfFactory.namedNode(new URL(iri.value).origin);
}

/**
 * Get the IRI of the directory containing {iri} or its parent if {iri} has a trailing slash.
 */
export function parentDir(iri: NamedNode): NamedNode {
    const url = new URL(iri.value);
    const endIndex = url.pathname.endsWith("/") ? -2 : -1;
    url.pathname = url.pathname.split("/").slice(0, endIndex).join("/");
    url.hash = "";
    url.search = "";

    return rdfFactory.namedNode(url.toString());
}

/**
 * Get the origin of the {iri} with trailing slash
 */
export function site(iri: NamedNode): NamedNode {
    return rdfFactory.namedNode(`${origin(iri).value}/`);
}
