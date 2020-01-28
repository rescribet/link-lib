import rdfFactory, {
    isBlankNode,
    isLiteral,
    isNamedNode,
    LowLevelStore,
    NamedNode,
    Node,
} from "@ontologies/core";
import rdf from "@ontologies/rdf";

import ll from "../ontology/ll";
import RDFIndex from "../store/RDFIndex";

import {
    DataObject,
    DataTuple,
    NamedBlobTuple,
    ParsedObject,
    SerializableDataTypes,
    SomeNode,
} from "../types";
import {
    MAIN_NODE_DEFAULT_IRI,
    NON_DATA_OBJECTS_CTORS,
} from "../utilities/constants";

const BASE = 36;
const DEC_CUTOFF = 2;
const IRI_LEN = 20;

function isPlainObject(o: any): o is DataObject {
    return typeof o === "object"
        && o !== null
        && !NON_DATA_OBJECTS_CTORS.find((c) => typeof o.prototype !== "undefined" && o instanceof c)
        && !Object.prototype.hasOwnProperty.call(o, "termType");
}

function isIterable(o: any): o is any[] | Set<any> {
    return Array.isArray(o) || o instanceof Set;
}

function uploadIRI(): NamedNode {
    return ll.ns(`blobs/a${Math.random().toString(BASE).substr(DEC_CUTOFF, IRI_LEN)}`);
}

/**
 * Converts an array to an RDF list-shaped {DataObject} for serialization.
 */
export function list(arr: SerializableDataTypes[]): DataObject {
    // @ts-ignore
    return arr.reduceRight((acc: DataObject, next: SerializableDataTypes) => ({
        [rdf.first.toString()]: next,
        [rdf.rest.toString()]: acc,
    }), rdf.nil);
}

/**
 * Converts an array to an RDF sequence-shaped {DataObject} for serialization.
 */
export function seq<T = any>(arr: T[], id?: SomeNode): DataObject {
    const base: DataObject = { [rdf.type.toString()]: rdf.Seq };
    if (id) {
        base["@id"] = id;
    }

    return arr.reduce(
        (acc, next, n) => Object.assign(acc, { [rdf.ns(`_${n}`).toString()]: next }),
        base,
    );
}

/** @private */
export function processObject(subject: Node,
                              predicate: NamedNode,
                              datum: DataObject | SerializableDataTypes | null | undefined,
                              store: LowLevelStore): NamedBlobTuple[] {
    let blobs: NamedBlobTuple[] = [];

    if (isIterable(datum)) {
        for (const subResource of datum) {
            if (isPlainObject(subResource)) {
                const id = (subResource as DataObject)["@id"] as SomeNode | undefined || rdfFactory.blankNode();
                blobs = blobs.concat(processDataObject(id, subResource as DataObject, store));
                store.add(subject, predicate, id);
            } else {
                blobs = blobs.concat(processObject(subject, predicate, subResource, store));
            }
        }
    } else if (typeof datum === "string"
        || typeof datum === "number"
        || typeof datum === "boolean"
        || datum instanceof Date) {
        store.add(subject, predicate, rdfFactory.literal(datum));
    } else if (datum instanceof File) {
        const f = uploadIRI();
        const file = rdfFactory.quad(subject, predicate, f);
        blobs.push([f, datum as File]);
        store.addQuad(file);
    } else if (isPlainObject(datum)) {
        const id = datum["@id"] as SomeNode | undefined || rdfFactory.blankNode();
        blobs = blobs.concat(processDataObject(id, datum, store));
        store.add(subject, predicate, id);
    } else if (isNamedNode(datum)) {
        store.add(subject, predicate, datum);
    } else if (isLiteral(datum)) {
        store.add(
            subject,
            predicate,
            rdfFactory.literal(
                datum[0],
                datum[2] || datum[1],
            ),
        );
    } else if (datum !== null && datum !== undefined) {
        store.add(subject, predicate, rdfFactory.literal(datum));
    }

    return blobs;
}

function processDataObject(subject: Node, data: DataObject, store: LowLevelStore): NamedBlobTuple[] {
    let blobs: NamedBlobTuple[] = [];
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
        if (keys[i] === "@id") { continue; }
        const predicate = keys[i];
        const datum = data[keys[i]];

        if (predicate === undefined) {
            throw new Error(`Unknown predicate ${keys[i]} given (for subject '${subject}').`);
        }

        blobs = blobs.concat(processObject(subject, predicate, datum, store));
    }

    return blobs;
}

export function dataToGraphTuple(data: DataObject): DataTuple {
    const store = new RDFIndex();
    const blobs = processDataObject(MAIN_NODE_DEFAULT_IRI, data, store);

    return [store, blobs];
}

/**
 * Convert a DataObject into a graph. Useful for writing test data in semi-plain JS objects
 * @param iriOrData The data object or an iri for the top-level object.
 * @param data The data object if an IRI was passed.
 * @param graph A graph to write the statements into.
 */
export function toGraph(
    iriOrData: SomeNode | DataObject,
    data?: DataObject,
    store?: LowLevelStore,
): ParsedObject {

    const passedIRI = isNamedNode(iriOrData) || isBlankNode(iriOrData);
    if (passedIRI && !data) {
        throw new TypeError("Only an IRI was passed to `toObject`, a valid data object has to be the second argument");
    }
    const embeddedIRI = ((passedIRI ? data : iriOrData) as DataObject)!["@id"];
    let iri;
    if (embeddedIRI) {
        if (typeof embeddedIRI !== "string") {
            throw new TypeError("Embedded IRI (`@id`) value must be of type string");
        }
        iri = rdfFactory.namedNode(embeddedIRI);
    } else {
        iri = passedIRI ? (iriOrData as SomeNode) : rdfFactory.blankNode();
    }
    const dataObj = passedIRI ? data! : (iriOrData as DataObject);

    const s = store || new RDFIndex();

    const blobs = processDataObject(iri, dataObj, s);

    return [iri, s, blobs];
}
