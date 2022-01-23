import { LinkedRenderStore } from "./LinkedRenderStore";

export { createStore } from "./createStore";
/** @internal */
export * from "./factoryHelpers";
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
    DEFAULT_TOPOLOGY,
    RENDER_CLASS_NAME,
} from "./utilities/constants";
export * from "./LinkedDataAPI";
export {
    AttributeKey,
    TypedRecord,
} from "./TypedRecord";
export { RecordState } from "./store/RecordState";
export { RecordStatus } from "./store/RecordStatus";
export {
    Id,
    FieldValue,
    FieldId,
    DataRecord,
    MultimapTerm,
} from "./store/StructuredStore";
export { default as RDFIndex } from "./store/RDFIndex";

export {
    LinkedRenderStore,
};

export default LinkedRenderStore; // tslint:disable-line no-default-export
