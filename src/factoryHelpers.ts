import rdfFactory, { Feature, Quad, Term } from "@ontologies/core";

export const equals = rdfFactory.supports[Feature.identity]
    ? (a: any, b: any): boolean => a === b
    : rdfFactory.supports[Feature.idStamp]
        ? (a: any, b: any): boolean => a?.id === b?.id
        : (a: any, b: any): boolean => rdfFactory.equals(a, b);

const noIdError = (obj: any): void => {
    throw new TypeError(`Factory has idStamp feature, but the property wasn't present on ${obj}`);
};

export const id = rdfFactory.supports[Feature.idStamp]
    ? (obj?: Term | Quad | any): number => (obj as any)?.id || noIdError(obj)
    : (obj?: Term | Quad | any): number => rdfFactory.id(obj);
