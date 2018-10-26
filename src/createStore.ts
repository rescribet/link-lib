import { NamedNode } from "rdflib";

import { LinkedRenderStore } from "./LinkedRenderStore";
import { linkMiddleware } from "./linkMiddleware";
import { LinkedRenderStoreOptions, MiddlewareActionHandler, MiddlewareFn } from "./types";

function applyMiddleware<T>(lrs: LinkedRenderStore<T>, ...layers: Array<MiddlewareFn<T>>): MiddlewareActionHandler {
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
export function createStore<T>(storeOpts: LinkedRenderStoreOptions<T>,
                               middleware: Array<MiddlewareFn<any>> = [],
                               trailingMiddleware: Array<MiddlewareFn<any>> = []): LinkedRenderStore<T> {

    const LRS = new LinkedRenderStore<T>(storeOpts);

    LRS.dispatch = applyMiddleware<T>(
        LRS,
        ...middleware,
        linkMiddleware(trailingMiddleware.length === 0),
        ...trailingMiddleware,
    );

    return LRS;
}
