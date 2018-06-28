import { LinkedRenderStore } from "./LinkedRenderStore";

export { RDFStore } from "./RDFStore";
export { Schema } from "./Schema";
export * from "./testUtilities";
export { transformers } from "./transformers/index";
export * from "./types";
export {
    allRDFPropertyStatements,
    allRDFValues,
    anyRDFValue,
    DEFAULT_TOPOLOGY,
    defaultNS,
    getPropBestLangRaw,
    getTermBestLang,
    isDifferentOrigin,
    memoizedNamespace,
    namedNodeByStoreIndex,
    namedNodeByIRI,
    normalizeType,
    RENDER_CLASS_NAME,
} from "./utilities";

export { LinkedRenderStore };

export default LinkedRenderStore; // tslint:disable-line no-default-export
