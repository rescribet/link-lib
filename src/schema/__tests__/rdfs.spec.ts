import "../../__tests__/useFactory";

import rdfFactory, { Node } from "@ontologies/core";
import * as rdfs from "@ontologies/rdfs";
import * as schemaNS from "@ontologies/schema";
import "jest";

import { RDFStore } from "../../RDFStore";
import { Schema } from "../../Schema";
import { VocabularyProcessingContext } from "../../types";
import { RDFS } from "../rdfs";

describe("RDFS", () => {
    const expectSuperMap = (ctx: VocabularyProcessingContext, mapItem: Node, equalValues: Node[]): void => {
        expect(ctx.superMap.get(mapItem.value))
            .toEqual(new Set(equalValues.map((v) => v.value)));
    };

    describe("#processStatement", () => {
        it("adds superclasses to the superMap", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();

            expect(ctx.superMap.get(schemaNS.CreativeWork.value)).toBeUndefined();

            RDFS.processStatement(
                schemaNS.BlogPosting.value,
                rdfs.subClassOf.value,
                schemaNS.CreativeWork,
                ctx,
            );
            expectSuperMap(ctx, schemaNS.BlogPosting, [
                    schemaNS.BlogPosting,
                    schemaNS.CreativeWork,
                    rdfs.Resource,
                ]);

            RDFS.processStatement(
                schemaNS.CreativeWork.value,
                rdfs.subClassOf.value,
                schemaNS.Thing,
                ctx,
            );
            expectSuperMap(ctx, schemaNS.CreativeWork, [
                    schemaNS.CreativeWork,
                    schemaNS.Thing,
                    rdfs.Resource,
                ]);
            expectSuperMap(ctx, schemaNS.BlogPosting, [
                    schemaNS.BlogPosting,
                    schemaNS.CreativeWork,
                    schemaNS.Thing,
                    rdfs.Resource,
                ]);
        });
    });

    describe("#processType", () => {
        /**
         * "All other classes are subclasses of this class"
         * https://www.w3.org/TR/2014/REC-rdf-schema-20140225/#ch_resource
         */
        it("marks the resource to be a subclass of rdfs:Resource", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();
            expect(ctx.superMap.get(rdfFactory.id(schemaNS.CreativeWork))).toBeUndefined();
            RDFS.processType(schemaNS.CreativeWork.value, ctx);

            expectSuperMap(
                ctx,
                schemaNS.CreativeWork,
                [
                    schemaNS.CreativeWork,
                    rdfs.Resource,
                ],
            );
        });
    });
});
