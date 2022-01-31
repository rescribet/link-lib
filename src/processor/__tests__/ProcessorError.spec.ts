/* @globals set, generator, init */
import "../../__tests__/useFactory";

import "jest";

import { ProcessorError } from "../ProcessorError";

const getMessage = (msg: string, response?: Response): ProcessorError => new ProcessorError(msg, response);

const r = new Response();

describe("ProcessorError", () => {
    describe("with message", () => {
        it("has a message", () => {
            expect(getMessage("info", undefined)).toHaveProperty("message", "info");
            expect(getMessage("info", undefined)).not.toHaveProperty("response", r);
        });
    });

    describe("with response", () => {
        it("has a message", () => {
            expect(getMessage("info", r)).toHaveProperty("response", r);
        });
    });
});
