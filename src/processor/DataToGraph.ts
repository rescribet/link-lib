import {
    BlankNode,
    Collection,
    IndexedFormula,
    Literal,
    NamedNode,
    Statement,
} from "rdflib";

import {
    DataObject,
    DataTuple,
    NamedBlobTuple,
    SerializableDataTypes,
    SomeNode,
} from "../types";
import { defaultNS, MAIN_NODE_DEFAULT_IRI, NON_DATA_OBJECTS_CTORS } from "../utilities/constants";
import { namedNodeByIRI } from "../utilities/memoizedNamespace";
import { expandProperty } from "../utilities/memoizedNamespace";

const BASE = 36;
const DEC_CUTOFF = 2;
const IRI_LEN = 20;

function isPlainObject(o: any): o is DataObject {
    return typeof o === "object"
        && o !== null
        && !NON_DATA_OBJECTS_CTORS.find((c) => o instanceof c)
        && !Object.prototype.hasOwnProperty.call(o, "termType");
}

function isIterable(o: any): o is any[] | Set<any> {
    return Array.isArray(o) || o instanceof Set;
}

function uploadIRI(): NamedNode {
    return defaultNS.ll(`blobs/a${Math.random().toString(BASE).substr(DEC_CUTOFF, IRI_LEN)}`);
}

/** @private */
export function processObject(subject: SomeNode,
                              predicate: NamedNode,
                              datum: DataObject | SerializableDataTypes | null | undefined,
                              graph: IndexedFormula): NamedBlobTuple[] {
    let blobs: NamedBlobTuple[] = [];

    if (isIterable(datum)) {
        const items = new Collection();
        for (const subResource of datum) {
            const bn = new BlankNode();
            blobs = blobs.concat(processObject(bn, predicate, subResource, graph));
            items.append(bn);
        }
        items.close();
        graph.add(subject, predicate, items);
    } else if (typeof datum === "string"
        || typeof datum === "number"
        || typeof datum === "boolean"
        || datum instanceof Date) {
        graph.add(subject, predicate, Literal.fromValue(datum));
    } else if (datum instanceof File) {
        const f = uploadIRI();
        const file = new Statement(subject, predicate, f);
        blobs.push([f, datum as File]);
        graph.add(file);
    } else if (isPlainObject(datum)) {
        const bn = new BlankNode();
        blobs = blobs.concat(processDataObject(bn, datum, graph));
        graph.add(subject, predicate, bn);
    } else if (datum && datum.termType === "NamedNode") {
        graph.add(subject, predicate, namedNodeByIRI(datum.value));
    } else if (datum && datum.termType === "Literal") {
        graph.add(subject, predicate, new Literal(datum.value, datum.language, namedNodeByIRI(datum.datatype.value)));
    } else if (datum !== null && datum !== undefined) {
        graph.add(subject, predicate, Literal.fromValue(datum));
    }

    return blobs;
}

function processDataObject(subject: SomeNode, data: DataObject, graph: IndexedFormula): NamedBlobTuple[] {
    let blobs: NamedBlobTuple[] = [];
    Object.keys(data).forEach((k) => {
        const predicate = expandProperty(k, defaultNS);
        const datum = data[k];

        if (predicate === undefined) {
            throw new Error(`Unknown predicate ${k} given.`);
        }

        blobs = blobs.concat(processObject(subject, predicate, datum, graph));
    });

    return blobs;
}

export function dataToGraphTuple(data: DataObject): DataTuple {
    const g = new IndexedFormula();

    const blobs = processDataObject(MAIN_NODE_DEFAULT_IRI, data, g);

    return [g, blobs];
}
