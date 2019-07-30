/* @globals set, generator, init */
import "jest";

import { RequestInitGenerator, RequestInitGeneratorOpts } from "../RequestInitGenerator";

const getGenerator = (opts?: Partial<RequestInitGeneratorOpts>): RequestInitGenerator =>
    new RequestInitGenerator(opts as RequestInitGeneratorOpts);

describe("RequestInitGenerator", () => {
    describe("#constructor", () => {
        it("sets the mode", () => {
            const subject = getGenerator({ csrfFieldName: "custom-element ", mode: "no-cors" });
            expect(subject).toHaveProperty("mode", "no-cors");
        });
    });

    describe("#authenticityHeader", () => {
        it("has the correct X-Requested-With header", () => {
            expect(getGenerator()).toHaveProperty("xRequestedWith", "XMLHttpRequest");
        });

        it("has no X-CSRF-Token header", () => {
            expect(getGenerator()).not.toHaveProperty("X-CSRF-Token");
        });
    });

    describe("#generate", () => {
        describe("with empty parameters", () => {
            const subject = getGenerator().generate(undefined, undefined);

            it("sets the credentials option", () => expect(subject).toHaveProperty("credentials", "include"));
            it("sets the method option", () => expect(subject).toHaveProperty("method", "GET"));
            it("sets the mode option", () => expect(subject).toHaveProperty("mode", "same-origin"));

            const headers = subject.headers;
            it("sets the Accept header", () => expect(headers).toHaveProperty("Accept", "text/turtle"));
            it("sets the X-Requested-With header", () => {
                expect(headers).toHaveProperty("X-Requested-With", "XMLHttpRequest");
            });
        });

        describe("with arguments", () => {
            const subject = getGenerator().generate("POST", "application/n-quads");

            it("sets the method option", () => expect(subject).toHaveProperty("method", "POST"));

            const headers = subject.headers;
            it("sets the Accept header", () => expect(headers).toHaveProperty("Accept", "application/n-quads"));

            it("sets the CSRF header", () => expect(headers).toHaveProperty("X-CSRF-Token"));
        });

        describe("without credentials", () => {
            const subject = getGenerator({ credentials: "omit" }).generate("POST", "application/n-quads");

            it("sets the method option", () => expect(subject).toHaveProperty("method", "POST"));

            const headers = subject.headers;
            it("sets the Accept header", () => expect(headers).toHaveProperty("Accept", "application/n-quads"));

            it("skips the CSRF header", () => expect(headers).not.toHaveProperty("X-CSRF-Token"));
        });
    });
});
