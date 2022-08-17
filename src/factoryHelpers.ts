import rdfFactory, { DataFactory, Feature, Quad, Term } from "@ontologies/core";
import { Id } from "./store/types";
import { SomeNode } from "./types";

export type Comparator = (a: any, b: any) => boolean;

export const createEqualComparator = (factory: DataFactory): Comparator => factory.supports[Feature.identity]
  ? (a: any, b: any): boolean => a === b
  : factory.supports[Feature.idStamp]
    ? (a: any, b: any): boolean => a?.id === b?.id
    : (a: any, b: any): boolean => factory.equals(a, b);

/** @internal */
export const equals = createEqualComparator(rdfFactory);

const noIdError = (obj: any): void => {
    throw new TypeError(`Factory has idStamp feature, but the property wasn't present on ${obj}`);
};

const noValueError = (obj: any): void => {
    throw new TypeError(`Unable to lookup property 'value' on ${obj}.`);
};

/** @internal */
export const id = rdfFactory.supports[Feature.idStamp]
    ? (obj?: Term | Quad | any): number => (obj as any)?.id || noIdError(obj)
    : (obj?: Term | Quad | any): number => rdfFactory.id(obj);

/** @internal */
export const value = (obj?: Term): string => (obj as any)?.value ?? noValueError(obj);

export const idToValue = (recordId: Id): SomeNode => {
    if (recordId.includes(":") && !recordId.startsWith("_:")) {
        return rdfFactory.namedNode(recordId);
    } else {
        return rdfFactory.blankNode(recordId);
    }
};
