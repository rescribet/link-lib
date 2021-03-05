import { LinkedDataAPI } from "./LinkedDataAPI";
import { LinkedRenderStore } from "./LinkedRenderStore";
import ll from "./ontology/ll";
import { DataProcessor } from "./processor/DataProcessor";
import { NamedNode } from "./rdf";
import { MiddlewareActionHandler, MiddlewareFn, MiddlewareWithBoundLRS } from "./types";

/**
 * Binds various uris to link actions.
 *
 * @see {createStore}
 * @param catchActions {boolean} Set to true to catch all left-over actions to {LinkedRenderStore#execActionByIRI}.
 */
export const linkMiddleware = <T, API extends LinkedDataAPI = DataProcessor>(catchActions = true):
  MiddlewareFn<T, API> => (lrs: LinkedRenderStore<T, API>): MiddlewareWithBoundLRS =>
        (next: MiddlewareActionHandler): MiddlewareActionHandler =>
            (action: NamedNode, args: any): Promise<any> => {

    if (action.value.startsWith(ll.ns("data/rdflib/").value)) {
        return Promise.resolve(lrs.touch(args[0], args[1]));
    }

    if (catchActions) {
        return lrs.execActionByIRI(action, args);
    }

    return next(action, args);
};
