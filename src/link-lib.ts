import {
    DEFAULT_TOPOLOGY,
    LinkedRenderStore,
    RENDER_CLASS_NAME,
} from "./LinkedRenderStore";

export { RDFStore } from "./RDFStore";
export { Schema } from "./Schema";
export * from "./testUtilities";
export { transformers } from "./transformers/index";
export * from "./types";
export {
    allRDFPropertyStatements,
    allRDFValues,
    anyRDFValue,
    defaultNS,
    isDifferentOrigin,
    memoizedNamespace,
    namedNodeByStoreIndex,
    namedNodeByIRI,
    normalizeType,
} from "./utilities";

export {
    DEFAULT_TOPOLOGY,
    LinkedRenderStore,
    RENDER_CLASS_NAME,
};

export default LinkedRenderStore; // tslint:disable-line no-default-export
