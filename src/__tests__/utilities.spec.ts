import "jest";
import {
    NamedNode,
} from "rdflib";

import { isDifferentOrigin } from "../utilities";

describe("utilities", () => {
    describe("#isDifferentOrigin", () => {
        it("is false on the same origin", () => {
            expect(isDifferentOrigin(new NamedNode("http://example.org/test"))).toBeFalsy();
        });

        it("is true on a different origin", () => {
            expect(isDifferentOrigin(new NamedNode("http://example.com/test"))).toBeTruthy();
        });
    });
});
