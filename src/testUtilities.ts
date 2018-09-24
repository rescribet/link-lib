import { NamedNode } from "rdflib";

import { ComponentStore } from "./ComponentStore";
import { LinkedDataAPI } from "./LinkedDataAPI";
import { LinkedRenderStore } from "./LinkedRenderStore";
import { DataProcessor } from "./processor/DataProcessor";
import { RDFStore } from "./RDFStore";
import { Schema } from "./Schema";
import { LinkedRenderStoreOptions } from "./types";

export type BasicComponent = () => string | undefined;

export class ComponentStoreTestProxy<T> extends ComponentStore<T> {
    public publicLookup(predicate: NamedNode,
                        type: NamedNode,
                        topology: NamedNode): T | undefined {
        return this.lookup(predicate.sI, type.sI, topology.sI);
    }
}

export interface ExplodedLRS<T> {
    api: LinkedDataAPI;
    processor: DataProcessor;
    lrs: LinkedRenderStore<T>;
    mapping: ComponentStoreTestProxy<T>;
    store: RDFStore;
    schema: Schema;
}

export type GetBasicStoreOpts = Partial<ExplodedLRS<BasicComponent>>;

export const getBasicStore = (opts: GetBasicStoreOpts  = {}): ExplodedLRS<BasicComponent> => {
    const store = opts.store || new RDFStore();
    const processor = opts.processor || new DataProcessor({ store });
    const api = opts.api || processor;
    const schema = opts.schema || new Schema(store);
    const mapping = opts.mapping || new ComponentStoreTestProxy<BasicComponent>(schema);

    const conf = {
        api,
        mapping,
        schema,
        store,
    } as LinkedRenderStoreOptions<BasicComponent>;
    const lrs = new LinkedRenderStore(conf);

    return {lrs, mapping, processor, schema, store} as ExplodedLRS<BasicComponent>;
};
