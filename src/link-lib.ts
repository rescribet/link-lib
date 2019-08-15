import { LinkedRenderStore } from "./LinkedRenderStore";

export { createStore } from "./createStore";
export { linkMiddleware } from "./linkMiddleware";
export { DataProcessor } from "./processor/DataProcessor";
export { RequestInitGenerator } from "./processor/RequestInitGenerator";
export { RDFStore, RDFStoreOpts } from "./RDFStore";
export { deltaProcessor } from "./store/deltaProcessor";
export { Schema } from "./Schema";
export * from "./testUtilities";
export {
    list,
    seq,
    toGraph,
} from "./processor/DataToGraph";
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

export { LinkedRenderStore };

export default LinkedRenderStore; // tslint:disable-line no-default-export
