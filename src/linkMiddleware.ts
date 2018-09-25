import { NamedNode } from "rdflib";

import { LinkedRenderStore } from "./LinkedRenderStore";
import { MiddlewareActionHandler, MiddlewareFn, MiddlewareWithBoundLRS } from "./types";
import { defaultNS } from "./utilities/constants";

/**
 * Binds various uris to link actions.
 *
 * @param catchActions {boolean} Set to true to catch and pass left-over actions to execActionByIRI.
 */
export const linkMiddleware = <T>(catchActions = true): MiddlewareFn<T> =>
    (lrs: LinkedRenderStore<T>): MiddlewareWithBoundLRS =>
        (next: MiddlewareActionHandler): MiddlewareActionHandler =>
            (action: NamedNode, args: any): Promise<any> => {

    if (action.value.startsWith(defaultNS.ll("data/rdflib/").value)) {
        return Promise.resolve(lrs.touch(args[0], args[1]));
    }

    if (catchActions) {
        return lrs.execActionByIRI(action, args);
    }

    return next(action, args);
};
