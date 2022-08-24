import { LinkedRenderStore } from "./LinkedRenderStore";

export { createStore } from "./createStore";
/** @internal */
export * from "./factoryHelpers";
export { linkMiddleware } from "./linkMiddleware";
export { DataProcessor } from "./processor/DataProcessor";
export { RequestInitGenerator } from "./processor/RequestInitGenerator";
export { ProcessorError } from "./processor/ProcessorError";
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
export {
    isGlobalId,
    isLocalId,
    mergeTerms,
} from "./utilities/slices";
export * from "./LinkedDataAPI";
export {
    AttributeKey,
    TypedRecord,
} from "./TypedRecord";
export { RecordState } from "./store/RecordState";
export { RecordStatus } from "./store/RecordStatus";
export {
    idField,
    StructuredStore,
} from "./store/StructuredStore";
export { DataSlice } from "./store/types";
export { DeepRecord } from "./store/types";
export { DeepRecordFieldValue } from "./store/types";
export { DataRecord } from "./store/types";
export { FieldSet } from "./store/types";
export { FieldValue } from "./store/types";
export { MultimapTerm } from "./store/types";
export { FieldId } from "./store/types";
export { Id } from "./store/types";

export {
    LinkedRenderStore,
};

export default LinkedRenderStore; // tslint:disable-line no-default-export
