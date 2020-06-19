import "../../__tests__/useHashFactory";

import rdfFactory, { Node } from "@ontologies/core";
import rdfx from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import schemaNS from "@ontologies/schema";
import xsd from "@ontologies/xsd";
import "jest";
import { id } from "../../factoryHelpers";

import example from "../../ontology/example";
import { RDFStore } from "../../RDFStore";
import { Schema } from "../../Schema";
import { VocabularyProcessingContext } from "../../types";
import { RDFS } from "../rdfs";

describe("RDFS", () => {
    const expectSuperMap = (ctx: VocabularyProcessingContext, mapItem: Node, equalValues: Node[]): void => {
        expect(ctx.superMap.get(rdfFactory.id(mapItem)))
            .toEqual(new Set(equalValues.map((v) => rdfFactory.id(v))));
    };

    describe("#processStatement", () => {
        it("infers type domain resource", () => {
            const schema = new Schema(new RDFStore());

            const data = rdfFactory.quad(example.ns("1"), rdfx.type, schemaNS.Person);
            const inference = rdfFactory.quad(example.ns("1"), rdfx.type, rdfs.Resource);

            expect(schema.holdsQuad(inference)).toBeFalsy();
            const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
            expect(inferred).not.toBeNull();
            expect(inferred).toContainEqual(inference);
        });

        it("infers type range class", () => {
            const schema = new Schema(new RDFStore());

            const data = rdfFactory.quad(example.ns("1"), rdfx.type, schemaNS.Person);
            const inference = rdfFactory.quad(schemaNS.Person, rdfx.type, rdfs.Class);

            expect(schema.holdsQuad(inference)).toBeFalsy();
            const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
            expect(inferred).not.toBeNull();
            expect(inferred).toContainEqual(inference);
        });

        it("adds superclasses to the superMap", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();

            expect(ctx.superMap.get(rdfFactory.id(schemaNS.CreativeWork))).toBeUndefined();

            RDFS.processStatement(
                rdfFactory.quad(schemaNS.BlogPosting, rdfs.subClassOf, schemaNS.CreativeWork),
                ctx,
            );
            expectSuperMap(ctx, schemaNS.BlogPosting, [
                    schemaNS.BlogPosting,
                    schemaNS.CreativeWork,
                    rdfs.Resource,
                ]);

            RDFS.processStatement(
                rdfFactory.quad(schemaNS.CreativeWork, rdfs.subClassOf, schemaNS.Thing),
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

        /** https://www.w3.org/TR/rdf-schema/#ch_datatype */
        it("Each instance of rdfs:Datatype is a subclass of rdfs:Literal", () => {
            const schema = new Schema(new RDFStore());
            const ctx = schema.getProcessingCtx();

            expect(ctx.store.isInstanceOf(id(xsd.string), id(rdfs.Datatype))).toBeTruthy();
            expectSuperMap(ctx, xsd.string, [
                // Each instance of rdfs:Datatype is a subclass of rdfs:Literal
                rdfs.Literal,
                // rdfs:Literal is a subclass of rdfs:Resource
                rdfs.Resource,
                // Identity
                xsd.string,
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
            const inference = rdfFactory.quad(schemaNS.CreativeWork, rdfx.type, rdfs.Class);

            expect(schema.holdsQuad(inference)).toBeFalsy();

            RDFS.processType(schemaNS.CreativeWork, ctx);

            expect(schema.holdsQuad(inference)).toBeTruthy();
        });

        /**
         * "All other classes are subclasses of this class"
         * https://www.w3.org/TR/2014/REC-rdf-schema-20140225/#ch_resource
         */
        it("marks the resource to be a subclass of rdfs:Resource", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();
            expect(ctx.superMap.get(rdfFactory.id(schemaNS.CreativeWork))).toBeUndefined();
            RDFS.processType(schemaNS.CreativeWork, ctx);

            expectSuperMap(ctx, schemaNS.CreativeWork, [
                    schemaNS.CreativeWork,
                    rdfs.Resource,
                ]);
        });
    });
});
