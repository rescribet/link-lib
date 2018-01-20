import { NamedNode } from "rdflib";

import { ComponentStore } from "./ComponentStore";
import { LinkedRenderStore } from "./LinkedRenderStore";
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
    lrs: LinkedRenderStore<T>;
    mapping: ComponentStoreTestProxy<T>;
    store: RDFStore;
    schema: Schema;
}

export const getBasicStore = (): ExplodedLRS<BasicComponent> => {
    const store = new RDFStore();
    const schema = new Schema(store);
    const mapping = new ComponentStoreTestProxy<BasicComponent>(schema);

    const opts = {
        mapping,
        schema,
        store,
    } as LinkedRenderStoreOptions<BasicComponent>;
    const lrs = new LinkedRenderStore(opts);

    return {lrs, mapping, schema, store} as ExplodedLRS<BasicComponent>;
};
