/* @globals set, generator, init */
import "jest";

import { ProcessorError } from "../ProcessorError";

describe("ProcessorError", () => {
    set("msg", () => undefined);
    set("response", () => undefined);
    subject(() => new ProcessorError(msg, response));

    its("message", () => isExpected.toEqual(""));

    describe("with message", () => {
        set("msg", () => "info");

        its("message", () => isExpected.toEqual("info"));
    });

    describe("with response", () => {
        set("response", () => "info");

        its("response", () => isExpected.toEqual("info"));
    });
});
