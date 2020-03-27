import "jest";
import "./useHashFactory";

import { LinkedRenderStore } from "../LinkedRenderStore";
import { linkMiddleware } from "../linkMiddleware";
import example from "../ontology/example";
import ll from "../ontology/ll";
import { MiddlewareActionHandler } from "../types";

interface ExplodedMiddleware {
    dispatch: MiddlewareActionHandler;
    execActionByIRI: jest.Mock;
    next: jest.Mock;
    touch: jest.Mock;
}

const createTestMiddleware = (catchActions: boolean = true): ExplodedMiddleware => {
    const next = jest.fn();
    const touch = jest.fn();
    const execActionByIRI = jest.fn();

    const mockstore = { execActionByIRI, touch };
    // @ts-ignore
    const dispatch = linkMiddleware<any>(catchActions)(mockstore as LinkedRenderStore<any>)(next);

    return {
        dispatch,
        execActionByIRI,
        next,
        touch,
    };
};

describe("linkMiddleware", () => {
    it("has coverage", () => {
        // It really has, but doesn't seem to be accounted for since the function is called in a helper function
        expect(linkMiddleware()).toBeDefined();
    });

    it("calls touch for data events", async () => {
        const middleware = createTestMiddleware();

        await middleware.dispatch(ll.ns("data/rdflib/done"), [example.ns("test"), undefined]);

        expect(middleware.execActionByIRI).toHaveBeenCalledTimes(0);
        expect(middleware.next).toHaveBeenCalledTimes(0);
        expect(middleware.touch).toHaveBeenCalledTimes(1);
    });

    it("passes actions down", async () => {
        const middleware = createTestMiddleware();

        await middleware.dispatch(example.ns("action/1"), undefined);

        expect(middleware.execActionByIRI).toHaveBeenCalledTimes(1);
        expect(middleware.next).toHaveBeenCalledTimes(0);
        expect(middleware.touch).toHaveBeenCalledTimes(0);
    });

    describe("without catchActions", () => {
        it("passes actions down", async () => {
            const middleware = createTestMiddleware(false);

            await middleware.dispatch(example.ns("action/1"), undefined);

            expect(middleware.execActionByIRI).toHaveBeenCalledTimes(0);
            expect(middleware.next).toHaveBeenCalledTimes(1);
            expect(middleware.touch).toHaveBeenCalledTimes(0);
        });
    });
});
