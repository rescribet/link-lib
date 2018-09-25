import { LinkedRenderStore } from "./LinkedRenderStore";

export { createStore } from "./createStore";
export { linkMiddleware } from "./linkMiddleware";
export { RDFStore } from "./RDFStore";
export { Schema } from "./Schema";
export * from "./testUtilities";
export { transformers } from "./transformers/index";
export * from "./types";
export {
    allRDFPropertyStatements,
    allRDFValues,
    anyRDFValue,
    getPropBestLangRaw,
    getTermBestLang,
    isDifferentOrigin,
    normalizeType,
} from "./utilities";
export {
    defaultNS,
    DEFAULT_TOPOLOGY,
    RENDER_CLASS_NAME,
} from "./utilities/constants";
export {
    memoizedNamespace,
    namedNodeByIRI,
    namedNodeByStoreIndex,
} from "./utilities/memoizedNamespace";

export { LinkedRenderStore };

export default LinkedRenderStore; // tslint:disable-line no-default-export
