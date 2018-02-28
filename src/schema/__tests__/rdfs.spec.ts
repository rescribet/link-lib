import "jest";
import {
    Statement,
} from "rdflib";

import { RDFStore } from "../../RDFStore";
import { Schema } from "../../Schema";
import { defaultNS as NS } from "../../utilities";
import { RDFS } from "../rdfs";

describe("RDFS", () => {
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

        it("adds superclasses to the superMap", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();

            expect(ctx.superMap.get(NS.schema("CreativeWork").value)).toBeUndefined();

            RDFS.processStatement(
                new Statement(NS.schema("BlogPost"), NS.rdfs("subClassOf"), NS.schema("CreativeWork")),
                ctx,
            );
            expect(ctx.superMap.get(NS.schema("BlogPost").value))
                .toEqual(new Set([
                    NS.schema("BlogPost").value,
                    NS.schema("CreativeWork").value,
                    NS.rdfs("Resource").value,
                ]));

            RDFS.processStatement(
                new Statement(NS.schema("CreativeWork"), NS.rdfs("subClassOf"), NS.schema("Thing")),
                ctx,
            );
            expect(ctx.superMap.get(NS.schema("CreativeWork").value))
                .toEqual(new Set([
                    NS.schema("CreativeWork").value,
                    NS.schema("Thing").value,
                    NS.rdfs("Resource").value,
                ]));
            expect(ctx.superMap.get(NS.schema("BlogPost").value))
                .toEqual(new Set([
                    NS.schema("BlogPost").value,
                    NS.schema("CreativeWork").value,
                    NS.schema("Thing").value,
                    NS.rdfs("Resource").value,
                ]));
        });
    });

    describe("#processType", () => {
        /**
         * We must assume all given resources to be an instance of RDFS:Class.
         * https://www.w3.org/TR/2014/REC-rdf-schema-20140225/#ch_subclassof
         */
        it("marks the resource as an instance of rdfs:Class", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();
            const inference = new Statement(NS.schema("CreativeWork"), NS.rdf("type"), NS.rdfs("Class"));

            expect(schema.holdsStatement(inference)).toBeFalsy();

            RDFS.processType(NS.schema("CreativeWork"), ctx);

            expect(schema.holdsStatement(inference)).toBeTruthy();
        });

        /**
         * "All other classes are subclasses of this class"
         * https://www.w3.org/TR/2014/REC-rdf-schema-20140225/#ch_resource
         */
        it("marks the resource to be a subclass of rdfs:Resource", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();
            expect(ctx.superMap.get(NS.schema("CreativeWork").value)).toBeUndefined();

            RDFS.processType(NS.schema("CreativeWork"), ctx);

            expect(ctx.superMap.get(NS.schema("CreativeWork").value))
                .toEqual(new Set([
                    NS.schema("CreativeWork").value,
                    NS.rdfs("Resource").value,
                ]));
        });
    });
});
