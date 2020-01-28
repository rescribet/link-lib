import "../../__tests__/useHashFactory";

import rdfFactory, { Node } from "@ontologies/core";
import rdfx from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import schemaOrg from "@ontologies/schema";
import "jest";

import { RDFStore } from "../../RDFStore";
import { Schema } from "../../Schema";
import { VocabularyProcessingContext } from "../../types";
import { defaultNS as NS } from "../../utilities/constants";
import { RDFS } from "../rdfs";

describe("RDFS", () => {
    const expectSuperMap = (ctx: VocabularyProcessingContext, mapItem: Node, equalValues: Node[]): void => {
        expect(ctx.superMap.get(mapItem))
            .toEqual(new Set(equalValues));
    };

    describe("#processStatement", () => {
        it("infers type domain resource", () => {
            const schema = new Schema(new RDFStore());

            const data = rdfFactory.quad(NS.example("1"), rdfx.type, schemaOrg.Person);
            const inference = rdfFactory.quad(NS.example("1"), rdfx.type, rdfs.Resource);

            expect(schema.holdsQuad(inference)).toBeFalsy();
            const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
            expect(inferred).not.toBeNull();
            expect(inferred).toContainEqual(inference);
        });

        it("infers type range class", () => {
            const schema = new Schema(new RDFStore());

            const data = rdfFactory.quad(NS.example("1"), rdfx.type, schemaOrg.Person);
            const inference = rdfFactory.quad(schemaOrg.Person, rdfx.type, rdfs.Class);

            expect(schema.holdsQuad(inference)).toBeFalsy();
            const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
            expect(inferred).not.toBeNull();
            expect(inferred).toContainEqual(inference);
        });

        it("adds superclasses to the superMap", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();

            expect(ctx.superMap.get(schemaOrg.CreativeWork)).toBeUndefined();

            RDFS.processStatement(
                rdfFactory.quad(schemaOrg.BlogPosting, rdfs.subClassOf, schemaOrg.CreativeWork),
                ctx,
            );
            expectSuperMap(ctx, schemaOrg.BlogPosting, [
                    schemaOrg.BlogPosting,
                    schemaOrg.CreativeWork,
                    rdfs.Resource,
                ]);

            RDFS.processStatement(
                rdfFactory.quad(schemaOrg.CreativeWork, rdfs.subClassOf, schemaOrg.Thing),
                ctx,
            );
            expectSuperMap(ctx, schemaOrg.CreativeWork, [
                    schemaOrg.CreativeWork,
                    schemaOrg.Thing,
                    rdfs.Resource,
                ]);
            expectSuperMap(ctx, schemaOrg.BlogPosting, [
                    schemaOrg.BlogPosting,
                    schemaOrg.CreativeWork,
                    schemaOrg.Thing,
                    rdfs.Resource,
                ]);
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
            const inference = rdfFactory.quad(schemaOrg.CreativeWork, rdfx.type, rdfs.Class);

            expect(schema.holdsQuad(inference)).toBeFalsy();

            RDFS.processType(schemaOrg.CreativeWork, ctx);

            expect(schema.holdsQuad(inference)).toBeTruthy();
        });

        /**
         * "All other classes are subclasses of this class"
         * https://www.w3.org/TR/2014/REC-rdf-schema-20140225/#ch_resource
         */
        it("marks the resource to be a subclass of rdfs:Resource", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();
            expect(ctx.superMap.get(schemaOrg.CreativeWork)).toBeUndefined();
            RDFS.processType(schemaOrg.CreativeWork, ctx);

            expectSuperMap(ctx, schemaOrg.CreativeWork, [
                    schemaOrg.CreativeWork,
                    rdfs.Resource,
                ]);
        });
    });
});
