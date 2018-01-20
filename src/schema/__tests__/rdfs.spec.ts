import "jest";
import {
    Statement,
} from "rdflib";

import { RDFStore } from "../../RDFStore";
import { Schema } from "../../Schema";
import { defaultNS as NS } from "../../utilities";
import { RDFS } from "../rdfs";

describe("#processStatement", () => {
    it("infers type domain resource", () => {
        const schema = new Schema(new RDFStore());

        const data = new Statement(NS.example("1"), NS.rdf("type"), NS.schema("Person"));
        const inference = new Statement(NS.example("1"), NS.rdf("type"), NS.rdfs("Resource"));

        expect(schema.holdsStatement(inference)).toBeFalsy();
        const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
        expect(inferred).not.toBeNull();
        expect(inferred).toContainEqual(inference);
    });

    it("infers type range class", () => {
        const schema = new Schema(new RDFStore());

        const data = new Statement(NS.example("1"), NS.rdf("type"), NS.schema("Person"));
        const inference = new Statement(NS.schema("Person"), NS.rdf("type"), NS.rdfs("Class"));

        expect(schema.holdsStatement(inference)).toBeFalsy();
        const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
        expect(inferred).not.toBeNull();
        expect(inferred).toContainEqual(inference);
    });
});
