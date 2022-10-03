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

export {
    SliceCreator,
    RecordBuilder,
    buildSlice,
    SliceBuilder,
} from "./datastrucures/DataSliceDSL";

export {
    Messages,
    IdMessage,
    FieldMessage,
    FieldSetMessage,
    ValueMessage,
    Message,
    SetRecordMessage,
    SetFieldMessage,
    AddFieldMessage,
    DeleteFieldMessage,
    DeleteFieldMatchingMessage,
    DeleteAllFieldsMatchingMessage,
    InvalidateRecordMessage,
    InvalidateAllWithPropertyMessage,
    setRecord,
    addField,
    setField,
    deleteAllFieldsMatching,
    deleteFieldMatching,
    deleteField,
    invalidateRecord,
    invalidateAllWithProperty,
} from "./messages/message";
export {
    MessageProcessor,
    createMessageProcessor,
} from "./messages/messageProcessor";

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
export { RDFAdapter } from "./store/RDFAdapter";

export {
    LinkedRenderStore,
};

export default LinkedRenderStore; // tslint:disable-line no-default-export
export { FieldValue } from "./datastrucures/Fields";
export { DataSlice } from "./datastrucures/DataSlice";
export { DataRecord } from "./datastrucures/DataSlice";
export { FieldSet } from "./datastrucures/DataSlice";
export { Id } from "./datastrucures/DataSlice";
export { DeepRecord } from "./datastrucures/DeepSlice";
export { DeepRecordFieldValue } from "./datastrucures/DeepSlice";
export { MultimapTerm } from "./datastrucures/Fields";
export { FieldId } from "./datastrucures/Fields";
