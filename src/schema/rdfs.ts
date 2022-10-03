import rdfFactory, { NamedNode, SomeTerm, TermType } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";

import { Id } from "../datastrucures/DataSlice";
import { VocabularyProcessingContext, VocabularyProcessor } from "../types";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();

/**
 * Implements the RDF/RDFS axioms and rules.
 */
export const RDFS: VocabularyProcessor = {
    axioms: [
        [rdf.type, rdfs.domain, rdfs.Resource, defaultGraph],
        [rdfs.domain, rdfs.domain, rdf.Property, defaultGraph],
        [rdfs.range, rdfs.domain, rdf.Property, defaultGraph],
        [rdfs.subPropertyOf, rdfs.domain, rdf.Property, defaultGraph],
        [rdfs.subClassOf, rdfs.domain, rdfs.Class, defaultGraph],
        [rdf.subject, rdfs.domain, rdf.Statement, defaultGraph],
        [rdf.predicate, rdfs.domain, rdf.Statement, defaultGraph],
        [rdf.object, rdfs.domain, rdf.Statement, defaultGraph],
        [rdfs.member, rdfs.domain, rdfs.Resource, defaultGraph],
        [rdf.first, rdfs.domain, rdf.List, defaultGraph],
        [rdf.rest, rdfs.domain, rdf.List, defaultGraph],
        [rdfs.seeAlso, rdfs.domain, rdfs.Resource, defaultGraph],
        [rdfs.isDefinedBy, rdfs.domain, rdfs.Resource, defaultGraph],
        [rdfs.comment, rdfs.domain, rdfs.Resource, defaultGraph],
        [rdfs.label, rdfs.domain, rdfs.Resource, defaultGraph],
        [rdf.value, rdfs.domain, rdfs.Resource, defaultGraph],

        [rdf.type, rdfs.range, rdfs.Class, defaultGraph],
        [rdfs.domain, rdfs.range, rdfs.Class, defaultGraph],
        [rdfs.range, rdfs.range, rdfs.Class, defaultGraph],
        [rdfs.subPropertyOf, rdfs.range, rdf.Property, defaultGraph],
        [rdfs.subClassOf, rdfs.range, rdfs.Class, defaultGraph],
        [rdf.subject, rdfs.range, rdfs.Resource, defaultGraph],
        [rdf.predicate, rdfs.range, rdfs.Resource, defaultGraph],
        [rdf.object, rdfs.range, rdfs.Resource, defaultGraph],
        [rdfs.member, rdfs.range, rdfs.Resource, defaultGraph],
        [rdf.first, rdfs.range, rdfs.Resource, defaultGraph],
        [rdf.rest, rdfs.range, rdf.List, defaultGraph],
        [rdfs.seeAlso, rdfs.range, rdfs.Resource, defaultGraph],
        [rdfs.isDefinedBy, rdfs.range, rdfs.Resource, defaultGraph],
        [rdfs.comment, rdfs.range, rdfs.Literal, defaultGraph],
        [rdfs.label, rdfs.range, rdfs.Literal, defaultGraph],
        [rdf.value, rdfs.range, rdfs.Resource, defaultGraph],

        [rdf.Alt, rdfs.subClassOf, rdfs.Container, defaultGraph],
        [rdf.Bag, rdfs.subClassOf, rdfs.Container, defaultGraph],
        [rdf.Seq, rdfs.subClassOf, rdfs.Container, defaultGraph],
        [rdfs.ContainerMembershipProperty, rdfs.subClassOf, rdf.Property, defaultGraph],

        [rdfs.isDefinedBy, rdfs.subPropertyOf, rdfs.seeAlso, defaultGraph],

        [rdfs.Datatype, rdfs.subClassOf, rdfs.Class, defaultGraph],

        [rdfs.Resource, rdf.type, rdfs.Class, defaultGraph],
        [rdfs.Class, rdf.type, rdfs.Class, defaultGraph],
    ],

    processStatement(
        recordId: Id,
        field: Id,
        value: SomeTerm,
        ctx: VocabularyProcessingContext,
    ): void {
        switch (field) {
            case rdfs.subClassOf.value: {            // C1 rdfs:subClassOf C2
                const objectType = value.termType;
                if (!(objectType === TermType.NamedNode || objectType === TermType.BlankNode)) {
                    throw new Error("Object of subClassOf statement must be a NamedNode");
                }

                const iSubject = recordId;
                const iObject = value.value;
                if (!ctx.superMap.has(iObject)) {
                    ctx.superMap.set(iObject, new Set([rdfs.Resource.value]));
                }

                let parents = ctx.superMap.get(iObject);
                if (parents === undefined) {
                    parents = new Set();
                    ctx.superMap.set(iObject, parents);
                }
                parents.add(iObject);
                const itemVal = ctx.superMap.get(iSubject) || new Set<string>([iSubject]);

                parents.forEach((i) => itemVal.add(i));

                ctx.superMap.set(iSubject, itemVal);
                ctx.superMap.forEach((v, k) => {
                    if (k !== iSubject && v.has(iSubject)) {
                        itemVal.forEach(v.add, v);
                    }
                });
                break;
            }
        }
    },

    processType(type: Id, ctx: VocabularyProcessingContext): boolean {
        RDFS.processStatement(type, rdfs.subClassOf.value, rdfs.Resource, ctx);
        return false;
    },
};
