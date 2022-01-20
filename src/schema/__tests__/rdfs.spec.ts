import "../../__tests__/useHashFactory";

import rdfFactory, { NamedNode, Node, QuadPosition, Quadruple } from "@ontologies/core";
import * as rdfx from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import * as schemaNS from "@ontologies/schema";
import "jest";

import example from "../../ontology/example";
import { RDFStore } from "../../RDFStore";
import { Schema } from "../../Schema";
import { VocabularyProcessingContext } from "../../types";
import { RDFS } from "../rdfs";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();

describe("RDFS", () => {
    const expectSuperMap = (ctx: VocabularyProcessingContext, mapItem: Node, equalValues: Node[]): void => {
        expect(ctx.superMap.get(rdfFactory.id(mapItem)))
            .toEqual(new Set(equalValues.map((v) => rdfFactory.id(v))));
    };

    describe("#processStatement", () => {
        it("infers type domain resource", () => {
            const schema = new Schema(new RDFStore());

            const data: Quadruple = [example.ns("1"), rdfx.type, schemaNS.Person, defaultGraph];
            const inference: Quadruple = [example.ns("1"), rdfx.type, rdfs.Resource, defaultGraph];

            expect(schema.holds(
                inference[QuadPosition.subject],
                inference[QuadPosition.predicate],
                inference[QuadPosition.object],
            )).toBeFalsy();
            const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
            expect(inferred).not.toBeNull();
            expect(inferred).toContainEqual(inference);
        });

        it("infers type range class", () => {
            const schema = new Schema(new RDFStore());

            const data: Quadruple = [example.ns("1"), rdfx.type, schemaNS.Person, defaultGraph];
            const inference: Quadruple = [schemaNS.Person, rdfx.type, rdfs.Class, defaultGraph];

            expect(schema.holds(
                inference[QuadPosition.subject],
                inference[QuadPosition.predicate],
                inference[QuadPosition.object],
            )).toBeFalsy();
            const inferred = RDFS.processStatement(data, schema.getProcessingCtx());
            expect(inferred).not.toBeNull();
            expect(inferred).toContainEqual(inference);
        });

        it("adds superclasses to the superMap", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();

            expect(ctx.superMap.get(rdfFactory.id(schemaNS.CreativeWork))).toBeUndefined();

            RDFS.processStatement(
                [schemaNS.BlogPosting, rdfs.subClassOf, schemaNS.CreativeWork, defaultGraph],
                ctx,
            );
            expectSuperMap(ctx, schemaNS.BlogPosting, [
                    schemaNS.BlogPosting,
                    schemaNS.CreativeWork,
                    rdfs.Resource,
                ]);

            RDFS.processStatement(
                [schemaNS.CreativeWork, rdfs.subClassOf, schemaNS.Thing, defaultGraph],
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
         * We must assume all given resources to be an instance of RDFS:Class.
         * https://www.w3.org/TR/2014/REC-rdf-schema-20140225/#ch_subclassof
         */
        it("marks the resource as an instance of rdfs:Class", () => {
            const schema = new Schema(new RDFStore());

            const ctx = schema.getProcessingCtx();

            expect(schema.holds(schemaNS.CreativeWork, rdfx.type, rdfs.Class)).toBeFalsy();

            RDFS.processType(schemaNS.CreativeWork, ctx);

            expect(schema.holds(schemaNS.CreativeWork, rdfx.type, rdfs.Class)).toBeTruthy();
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
