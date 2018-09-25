import { NamedNode } from "rdflib";

import { LinkedRenderStore } from "./LinkedRenderStore";
import { linkMiddleware } from "./linkMiddleware";
import { LinkedRenderStoreOptions, MiddlewareActionHandler, MiddlewareFn } from "./types";

function applyMiddleware<T>(lrs: LinkedRenderStore<T>, ...layers: Array<MiddlewareFn<T>>): MiddlewareActionHandler {
    const storeBound = layers.map((middleware) => middleware(lrs));

    const finish: MiddlewareActionHandler = (a: NamedNode, _o: any): Promise<any> => Promise.resolve(a);

    return storeBound.reduceRight((composed, f) => f(composed), finish);
}

export function createStore<T>(storeOpts: LinkedRenderStoreOptions<T>,
                               middleware = [],
                               trailingMiddleware = []): LinkedRenderStore<T> {

    const LRS = new LinkedRenderStore<T>(storeOpts);

    LRS.dispatch = applyMiddleware<T>(
        LRS,
        ...middleware,
        linkMiddleware(trailingMiddleware.length > 0),
        ...trailingMiddleware,
    );

    return LRS;
}
