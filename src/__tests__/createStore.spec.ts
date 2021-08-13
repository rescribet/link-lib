import { createStore } from "../createStore";
import { LinkedRenderStore } from "../LinkedRenderStore";
import ex from "../ontology/ex";

describe("createStore", () => {
  it("can be called without arguments", () => {
    const store = createStore();
    expect(store).toBeInstanceOf(LinkedRenderStore);
  });

  it("passes store options", () => {
    const report = jest.fn();

    const store = createStore({
      report,
    });

    expect(store.report).toBe(report);
  });

  it("prefixes the middleware", () => {
    const handler = jest.fn();
    const connector = jest.fn((_) => handler);
    const middleware = jest.fn(() => connector);

    const store = createStore({}, [middleware]);
    expect(middleware).toHaveBeenCalled();

    store.dispatch(ex.ns("a"));
    expect(handler).toHaveBeenCalledWith(ex.ns("a"));
  });

  it("throws on invalid middleware", () => {
    const middlewareHandler = jest.fn();
    const middleware = jest.fn(() => middlewareHandler);

    expect(() => {
      createStore({}, [middleware]);
    }).toThrow();
  });
});
