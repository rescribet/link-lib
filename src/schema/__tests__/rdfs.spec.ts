import "../../__tests__/useHashFactory";

import rdfFactory from "@ontologies/core";
import "jest";

import { RDFStore } from "../../RDFStore";
import { Schema } from "../../Schema";
import { defaultNS as NS } from "../../utilities/constants";
import { RDFS } from "../rdfs";

describe("RDFS", () => {
    describe("#processStatement", () => {
        it("infers type domain resource", () => {
            const schema = new Schema(new RDFStore());

            const data = rdfFactory.quad(NS.example("1"), NS.rdf("type"), NS.schema("Person"));
            const inference = rdfFactory.quad(NS.example("1"), NS.rdf("type"), NS.rdfs("Resource"));

            expect(schema.holdsStatement(inference)).toBeFalsy();
            const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
            expect(inferred).not.toBeNull();
            expect(inferred).toContainEqual(inference);
        });

        it("infers type range class", () => {
            const schema = new Schema(new RDFStore());

            const data = rdfFactory.quad(NS.example("1"), NS.rdf("type"), NS.schema("Person"));
            const inference = rdfFactory.quad(NS.schema("Person"), NS.rdf("type"), NS.rdfs("Class"));

            expect(schema.holdsStatement(inference)).toBeFalsy();
            const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
            expect(inferred).not.toBeNull();
            expect(inferred).toContainEqual(inference);
        });

        it("adds superclasses to the superMap", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();

            expect(ctx.superMap.get(rdfFactory.id(NS.schema("CreativeWork")))).toBeUndefined();

            RDFS.processStatement(
                rdfFactory.quad(NS.schema("BlogPost"), NS.rdfs("subClassOf"), NS.schema("CreativeWork")),
                ctx,
            );
            expect(ctx.superMap.get(rdfFactory.id(NS.schema("BlogPost"))))
                .toEqual(new Set([
                    rdfFactory.id(NS.schema("BlogPost")),
                    rdfFactory.id(NS.schema("CreativeWork")),
                    rdfFactory.id(NS.rdfs("Resource")),
                ]));

            RDFS.processStatement(
                rdfFactory.quad(NS.schema("CreativeWork"), NS.rdfs("subClassOf"), NS.schema("Thing")),
                ctx,
            );
            expect(ctx.superMap.get(rdfFactory.id(NS.schema("CreativeWork"))))
                .toEqual(new Set([
                    rdfFactory.id(NS.schema("CreativeWork")),
                    rdfFactory.id(NS.schema("Thing")),
                    rdfFactory.id(NS.rdfs("Resource")),
                ]));
            expect(ctx.superMap.get(rdfFactory.id(NS.schema("BlogPost"))))
                .toEqual(new Set([
                    rdfFactory.id(NS.schema("BlogPost")),
                    rdfFactory.id(NS.schema("CreativeWork")),
                    rdfFactory.id(NS.schema("Thing")),
                    rdfFactory.id(NS.rdfs("Resource")),
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
            const inference = rdfFactory.quad(NS.schema("CreativeWork"), NS.rdf("type"), NS.rdfs("Class"));

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
            expect(ctx.superMap.get(rdfFactory.id(NS.schema("CreativeWork")))).toBeUndefined();

            RDFS.processType(NS.schema("CreativeWork"), ctx);

            expect(ctx.superMap.get(rdfFactory.id(NS.schema("CreativeWork"))))
                .toEqual(new Set([
                    rdfFactory.id(NS.schema("CreativeWork")),
                    rdfFactory.id(NS.rdfs("Resource")),
                ]));
        });
    });
});
