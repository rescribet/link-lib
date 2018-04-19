/* @globals set, generator, init */
import "jest";

import { RequestInitGenerator } from "../RequestInitGenerator";

describe("RequestInitGenerator", () => {
    set("opts", () => undefined);
    set("generator", () => new RequestInitGenerator(opts));
    subject(() => generator);
    set("method", () => undefined);
    set("accept", () => undefined);

    describe("#constructor", () => {
        set("opts", () => ({ csrfFieldName: "custom-element ", mode: "no-cors" }));

        its("mode", () => isExpected.toEqual("no-cors"));
    });

    describe("#authenticityHeader", () => {
        subject(() => generator.authenticityHeader());

        its("X-Requested-With", () => isExpected.toEqual("XMLHttpRequest"));
        its("X-CSRF-Token", () => isExpected.toEqual(""));
    });

    describe("#generate", () => {
        subject(() => generator.generate(method, accept));

        its("credentials", () => isExpected.toEqual("include"));
        its("method", () => isExpected.toEqual("GET"));
        its("mode", () => isExpected.toEqual("same-origin"));

        its("headers.Accept", () => isExpected.toEqual("text/turtle"));
        its("headers.X-Requested-With", () => isExpected.toEqual("XMLHttpRequest"));

        describe("with arguments", () => {
            set("method", () => "POST");
            set("accept", () => "application/n-quads");

            its("method", () => isExpected.toEqual("POST"));
            its("headers.Accept", () => isExpected.toEqual("application/n-quads"));
        });
    });
});
