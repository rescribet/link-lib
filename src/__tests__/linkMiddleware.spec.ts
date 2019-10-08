import "jest";
import "./useHashFactory";

import { LinkedRenderStore } from "../LinkedRenderStore";
import { linkMiddleware } from "../linkMiddleware";
import { MiddlewareActionHandler } from "../types";
import { defaultNS } from "../utilities/constants";

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

        await middleware.dispatch(defaultNS.ll("data/rdflib/done"), [defaultNS.example("test"), undefined]);

        expect(middleware.execActionByIRI).toHaveBeenCalledTimes(0);
        expect(middleware.next).toHaveBeenCalledTimes(0);
        expect(middleware.touch).toHaveBeenCalledTimes(1);
    });

    it("passes actions down", async () => {
        const middleware = createTestMiddleware();

        await middleware.dispatch(defaultNS.example("action/1"), undefined);

        expect(middleware.execActionByIRI).toHaveBeenCalledTimes(1);
        expect(middleware.next).toHaveBeenCalledTimes(0);
        expect(middleware.touch).toHaveBeenCalledTimes(0);
    });

    describe("without catchActions", () => {
        it("passes actions down", async () => {
            const middleware = createTestMiddleware(false);

            await middleware.dispatch(defaultNS.example("action/1"), undefined);

            expect(middleware.execActionByIRI).toHaveBeenCalledTimes(0);
            expect(middleware.next).toHaveBeenCalledTimes(1);
            expect(middleware.touch).toHaveBeenCalledTimes(0);
        });
    });
});
