import { NamedNode } from "@ontologies/core";

import { LinkedDataAPI } from "./LinkedDataAPI";
import { LinkedRenderStore } from "./LinkedRenderStore";
import { linkMiddleware } from "./linkMiddleware";
import { DataProcessor } from "./processor/DataProcessor";
import { LinkedRenderStoreOptions, MiddlewareActionHandler, MiddlewareFn } from "./types";

function applyMiddleware<T, API extends LinkedDataAPI = DataProcessor>(
  lrs: LinkedRenderStore<T, API>,
  ...layers: Array<MiddlewareFn<T, API>>
): MiddlewareActionHandler {
    const storeBound = layers.map((middleware) => middleware(lrs));

    const finish: MiddlewareActionHandler = (a: NamedNode, _o: any): Promise<any> => Promise.resolve(a);

    return storeBound.reduceRight((composed, f) => f(composed), finish);
}

/**
 * Initializes a {LinkedRenderStore} with tied together middleware.
 * @param storeOpts Constructor arguments for the LRS.
 * @param middleware Main middleware, to be executed before the {linkMiddelware}.
 * @param trailingMiddleware Middleware to be placed after the {linkMiddleware}. Note: defining trailing middleware
 *  causes actions not to be executed via {LinkedRenderStore#execActionByIRI} anymore, this behaviour can be enabled
 *  manually in one of the defined middlewares if still desired.
 */
export function createStore<T, API extends LinkedDataAPI = DataProcessor>(
  storeOpts: LinkedRenderStoreOptions<T, API>,
  middleware: Array<MiddlewareFn<any, API>> = [],
  trailingMiddleware: Array<MiddlewareFn<any, API>> = [],
): LinkedRenderStore<T, API> {
    const LRS = new LinkedRenderStore<T, API>(storeOpts);

    LRS.dispatch = applyMiddleware<T, API>(
        LRS,
        ...middleware,
        linkMiddleware(trailingMiddleware.length === 0),
        ...trailingMiddleware,
    );

    return LRS;
}
