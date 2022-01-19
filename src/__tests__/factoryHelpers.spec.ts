import "jest";

import rdfFactory, {
    DataFactory,
    Feature,
    NamedNode,
} from "@ontologies/core";
import * as schema from "@ontologies/schema";
import { createEqualComparator, id } from "../factoryHelpers";

describe("factoryHelpers", () => {
    describe("createEqualComparator", () => {
        describe("without idStamp factory", () => {
            const factory = {
                defaultGraph(): NamedNode { return rdfFactory.namedNode("rdf:defaultGraph"); },
                equals: jest.fn(),
                supports: {
                    [Feature.identity]: false,
                    [Feature.idStamp]: false,
                },
            } as unknown as DataFactory;
            const equals = createEqualComparator(factory);

            it("calls the factory comparison method", () => {
                equals("a", "b");
                expect(factory.equals).toHaveBeenCalledWith("a", "b");
            });
        });

        describe("without idStamp factory", () => {
            const factory = {
                defaultGraph(): NamedNode { return rdfFactory.namedNode("rdf:defaultGraph"); },
                supports: {
                    [Feature.identity]: false,
                    [Feature.idStamp]: true,
                },
            } as DataFactory;
            const equals = createEqualComparator(factory);

            it("compares equal nodes", () => {
                expect(equals({  id: 2 }, { id: 2 })).toBeTruthy();
            });

            it("compares unequal nodes", () => {
                expect(equals({  id: 2 }, { id: 3 })).toBeFalsy();
            });
        });

        describe("with identity factory", () => {
            const factory = {
                defaultGraph(): NamedNode { return rdfFactory.namedNode("rdf:defaultGraph"); },
                supports: {
                    [Feature.identity]: true,
                    [Feature.idStamp]: false,
                },
            } as DataFactory;
            const equals = createEqualComparator(factory);

            it("compares equal nodes", () => {
                const node = {};
                expect(equals(node, node)).toBeTruthy();
            });

            it("compares unequal nodes", () => {
                expect(equals({}, {})).toBeFalsy();
            });

            it("compares undefined", () => {
                expect(equals(undefined, {})).toBeFalsy();
                expect(equals({}, undefined)).toBeFalsy();
            });
        });
    });

    describe("id", () => {
        describe("without identity factory", () => {
            it("retrieves node ids", () => {
                expect(id(schema.name)).toEqual("<http://schema.org/name>");
            });

            it("throws on undefined", () => {
                expect(() => {
                    id(undefined);
                }).toThrow(TypeError);
            });
        });
    });
});
