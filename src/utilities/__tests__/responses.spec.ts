import "jest";
import { ResponseAndFallbacks } from "../../types";

import {
    contentTypeByExtention,
    contentTypeByMimeString,
    getContentType,
    getHeader,
} from "../responses";

describe("responses", () => {
    describe("#contentTypeByExtention", () => {
        it("detects turtle", () => {
            expect(contentTypeByExtention("ttl")).toEqual("text/turtle");
        });

        it("detects ntriples", () => {
            expect(contentTypeByExtention("nt")).toEqual("application/n-triples");
            expect(contentTypeByExtention("ntriples")).toEqual("application/n-triples");
        });

        it("detects n3", () => {
            expect(contentTypeByExtention("n3")).toEqual("text/n3");
        });

        it("detects json-ld", () => {
            expect(contentTypeByExtention("jsonld")).toEqual("application/ld+json");
        });
    });

    describe("#contentTypeByMimeString", () => {
        it("returns undefined for unknown content-types", () => {
            expect(contentTypeByMimeString("text/html", ".html")).toBeUndefined();
        });

        it("detects old-school turtle", () => {
            expect(contentTypeByMimeString("application/x-turtle", "")).toEqual("text/turtle");
        });
        it("detects old-school ntriples", () => {
            expect(contentTypeByMimeString("text/ntriples", "")).toEqual("application/n-triples");
        });

        it("detects plaintext ntriples by ext", () => {
            expect(contentTypeByMimeString("text/plain", "nt")).toEqual("application/n-triples");
        });

        it("detects n3", () => {
            expect(contentTypeByMimeString("text/n3", "")).toEqual("text/n3");
        });

        it("detects json-ld", () => {
            expect(contentTypeByMimeString("application/ld+json", "")).toEqual("application/ld+json");
        });
    });

    describe("#getContentType", () => {
        it("returns the content-type for known extensions", () => {
            const response = {
                body: "",
                headers: {"Content-Type": "*/*"},
                requestedURI: "http://example.com/test.ttl",
                status: 200,
            };
            expect(getContentType(response)).toEqual("text/turtle");
        });

        it("returns the content-type for known values", () => {
            const response = {
                body: "",
                headers: {"Content-Type": "application/rdf+xml; text/xml; application/xml"},
                requestedURI: "http://example.com/",
                status: 200,
            };
            expect(getContentType(response)).toEqual("application/rdf+xml");
        });

        it("returns the first content-type", () => {
            const response = {
                body: "",
                headers: {"Content-Type": "text/html; application/xhtml+xml"},
                requestedURI: "http://example.com/",
                status: 200,
            };
            expect(getContentType(response)).toEqual("text/html");
        });
    });

    describe("#getHeader", () => {
        it("works with fetch responses", () => {
            const response = new Response(null, {
                headers: {
                    "Content-Type": "text/turtle",
                },
            });
            // @ts-ignore
            response.headers = {
                get: (header: string): string | undefined => {
                    if (header === "Content-Type") {
                        return "text/turtle";
                    }
                    return undefined;
                },
            };
            // expect(typeof response.headers.get).toEqual("function");
            expect(getHeader(response, "Content-Type")).toEqual("text/turtle");
        });

        it("works with response mocks", () => {
            const response = {
                body: "",
                headers: {"Content-Type": "*/*"},
                requestedURI: "http://example.com/test.ttl",
                status: 200,
            };
            expect(getHeader(response, "Content-Type")).toEqual("*/*");
        });

        it("returns null when no headers were found", () => {
            const response = {
                body: "",
                requestedURI: "http://example.com/test.ttl",
                status: 200,
            };
            expect(getHeader((response as ResponseAndFallbacks), "Content-Type")).toBeNull();
        });
    });
});
