import "jest";
import "./useHashFactory";

import rdfFactory from "@ontologies/core";
import schema from "@ontologies/schema";
import { equals, id } from "../factoryHelpers";

describe("factoryHelpers", () => {
    describe("with hash factory", () => {
        describe("equals", () => {
            it("compares nodes", () => {
                expect(equals(schema.name, rdfFactory.namedNode("http://schema.org/name"))).toBeTruthy();
            });

            it("compares undefined", () => {
                expect(equals(undefined, rdfFactory.namedNode("http://schema.org/name"))).toBeFalsy();
                expect(equals(schema.name, undefined)).toBeFalsy();
            });
        });

        describe("id", () => {
            it("retrieves node ids", () => {
                expect(id(schema.name)).toEqual(3658353846);
            });

            it("throws on undefined", () => {
                expect(() => {
                    id(undefined);
                }).toThrow(TypeError);
            });
        });
    });
});
