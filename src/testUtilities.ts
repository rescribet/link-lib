import { ComponentStore } from "./ComponentStore/ComponentStore";
import { createStore } from "./createStore";
import { LinkedRenderStore } from "./LinkedRenderStore";
import { DataProcessor } from "./processor/DataProcessor";
import { RDFStore } from "./RDFStore";
import { Schema } from "./Schema";
import {
    DataProcessorOpts,
    Indexable,
    LinkedRenderStoreOptions,
    MiddlewareActionHandler,
} from "./types";

export type BasicComponent = () => string | undefined;

export class ComponentStoreTestProxy<T> extends ComponentStore<T> {
    public publicLookup(predicate: Indexable,
                        obj: Indexable,
                        topology: Indexable): T | undefined {
        return this.lookup(predicate, obj, topology);
    }
}

export interface ExplodedLRS<T> {
    api: DataProcessor;
    apiOpts: Partial<DataProcessorOpts>;
    dispatch: MiddlewareActionHandler;
    forceBroadcast: () => Promise<void>;
    processor: DataProcessor;
    lrs: LinkedRenderStore<T>;
    mapping: ComponentStoreTestProxy<T>;
    store: RDFStore;
    schema: Schema;
}

export type GetBasicStoreOpts = Partial<ExplodedLRS<BasicComponent>>;

export const getBasicStore = (opts: GetBasicStoreOpts  = {}): ExplodedLRS<BasicComponent> => {
    const report = (e: unknown): void => { throw e; };
    const store = opts.store ?? new RDFStore();
    const processor = opts.processor ?? new DataProcessor({ report, store, ...opts.apiOpts });
    const api = opts.api ?? processor;
    const schema = opts.schema ?? new Schema(store);
    const mapping = opts.mapping ?? new ComponentStoreTestProxy<BasicComponent>(schema);

    const conf = {
        api,
        mapping,
        report,
        schema,
        store,
    } as LinkedRenderStoreOptions<BasicComponent, DataProcessor>;
    const lrs = createStore(conf);
    (lrs as any).resourceQueueFlushTimer = 0;

    return {
        dispatch: lrs.dispatch,
        forceBroadcast: (): Promise<void> => (lrs as any).broadcast(false, 0),
        lrs,
        mapping,
        processor,
        schema,
        store,
    } as ExplodedLRS<BasicComponent>;
};
