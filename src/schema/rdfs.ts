import rdfFactory, { NamedNode, Quad, TermType } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";

import { equals, id } from "../factoryHelpers";
import { VocabularyProcessingContext, VocabularyProcessor } from "../types";

/**
 * Implements the RDF/RDFS axioms and rules.
 * @type {VocabularyProcessor}
 */
export const RDFS = {
    axioms: [
        rdfFactory.quad(rdf.type, rdfs.domain, rdfs.Resource),
        rdfFactory.quad(rdfs.domain, rdfs.domain, rdf.Property),
        rdfFactory.quad(rdfs.range, rdfs.domain, rdf.Property),
        rdfFactory.quad(rdfs.subPropertyOf, rdfs.domain, rdf.Property),
        rdfFactory.quad(rdfs.subClassOf, rdfs.domain, rdfs.Class),
        rdfFactory.quad(rdf.subject, rdfs.domain, rdf.Statement),
        rdfFactory.quad(rdf.predicate, rdfs.domain, rdf.Statement),
        rdfFactory.quad(rdf.object, rdfs.domain, rdf.Statement),
        rdfFactory.quad(rdfs.member, rdfs.domain, rdfs.Resource),
        rdfFactory.quad(rdf.first, rdfs.domain, rdf.List),
        rdfFactory.quad(rdf.rest, rdfs.domain, rdf.List),
        rdfFactory.quad(rdfs.seeAlso, rdfs.domain, rdfs.Resource),
        rdfFactory.quad(rdfs.isDefinedBy, rdfs.domain, rdfs.Resource),
        rdfFactory.quad(rdfs.comment, rdfs.domain, rdfs.Resource),
        rdfFactory.quad(rdfs.label, rdfs.domain, rdfs.Resource),
        rdfFactory.quad(rdf.value, rdfs.domain, rdfs.Resource),

        rdfFactory.quad(rdf.type, rdfs.range, rdfs.Class),
        rdfFactory.quad(rdfs.domain, rdfs.range, rdfs.Class),
        rdfFactory.quad(rdfs.range, rdfs.range, rdfs.Class),
        rdfFactory.quad(rdfs.subPropertyOf, rdfs.range, rdf.Property),
        rdfFactory.quad(rdfs.subClassOf, rdfs.range, rdfs.Class),
        rdfFactory.quad(rdf.subject, rdfs.range, rdfs.Resource),
        rdfFactory.quad(rdf.predicate, rdfs.range, rdfs.Resource),
        rdfFactory.quad(rdf.object, rdfs.range, rdfs.Resource),
        rdfFactory.quad(rdfs.member, rdfs.range, rdfs.Resource),
        rdfFactory.quad(rdf.first, rdfs.range, rdfs.Resource),
        rdfFactory.quad(rdf.rest, rdfs.range, rdf.List),
        rdfFactory.quad(rdfs.seeAlso, rdfs.range, rdfs.Resource),
        rdfFactory.quad(rdfs.isDefinedBy, rdfs.range, rdfs.Resource),
        rdfFactory.quad(rdfs.comment, rdfs.range, rdfs.Literal),
        rdfFactory.quad(rdfs.label, rdfs.range, rdfs.Literal),
        rdfFactory.quad(rdf.value, rdfs.range, rdfs.Resource),

        rdfFactory.quad(rdf.Alt, rdfs.subClassOf, rdfs.Container),
        rdfFactory.quad(rdf.Bag, rdfs.subClassOf, rdfs.Container),
        rdfFactory.quad(rdf.Seq, rdfs.subClassOf, rdfs.Container),
        rdfFactory.quad(rdfs.ContainerMembershipProperty, rdfs.subClassOf, rdf.Property),

        rdfFactory.quad(rdfs.isDefinedBy, rdfs.subPropertyOf, rdfs.seeAlso),

        rdfFactory.quad(rdfs.Literal, rdfs.subClassOf, rdfs.Resource),
        rdfFactory.quad(rdfs.Datatype, rdfs.subClassOf, rdfs.Class),

        rdfFactory.quad(rdfs.Resource, rdf.type, rdfs.Class),
        rdfFactory.quad(rdfs.Class, rdf.type, rdfs.Class),

        rdfFactory.quad(rdfs.Resource, rdf.type, rdfs.Class),
        rdfFactory.quad(rdfs.Literal, rdf.type, rdfs.Class),
        rdfFactory.quad(rdf.langString, rdf.type, rdfs.Class),
        rdfFactory.quad(rdf.HTML, rdf.type, rdfs.Class),
        rdfFactory.quad(rdf.XMLLiteral, rdf.type, rdfs.Class),
        rdfFactory.quad(rdfs.Class, rdf.type, rdfs.Class),
        rdfFactory.quad(rdf.Property, rdf.type, rdfs.Class),
        rdfFactory.quad(rdfs.Datatype, rdf.type, rdfs.Class),
        rdfFactory.quad(rdf.Statement, rdf.type, rdfs.Class),
        rdfFactory.quad(rdf.Bag, rdf.type, rdfs.Class),
        rdfFactory.quad(rdf.Seq, rdf.type, rdfs.Class),
        rdfFactory.quad(rdf.Alt, rdf.type, rdfs.Class),
        rdfFactory.quad(rdfs.Container, rdf.type, rdfs.Class),
        rdfFactory.quad(rdfs.ContainerMembershipProperty, rdf.type, rdfs.Class),
        rdfFactory.quad(rdf.List, rdf.type, rdfs.Class),

    ],

    processStatement(item: Quad, ctx: VocabularyProcessingContext): Quad[] | null {
        const result = [item];

        const domainStatements = ctx.store.match(item.predicate, rdfs.domain, null, null);
        if (domainStatements.length > 0) {
            for (let i = 0; i < domainStatements.length; i++) {
                result.push(rdfFactory.quad(item.subject as NamedNode, rdf.type, domainStatements[i].object));
            }
        }

        const rangeStatements = ctx.store.match(item.predicate, rdfs.range, null, null);
        if (rangeStatements.length > 0) {                                                     // P rdfs:range C..Cn
            for (let i = 0; i < rangeStatements.length; i++) {
                result.push(rdfFactory.quad(item.object as NamedNode, rdf.type, rangeStatements[i].object));
            }
        }

        if (equals(rdfs.domain, item.predicate)) {
            result.push(rdfFactory.quad(item.subject, rdf.type, rdf.Property));     // P rdf:type rdf:Property
            result.push(rdfFactory.quad(item.object, rdf.type, rdfs.Class));        // C rdf:type rdfs:Class

            const dereferences = ctx.store.match(item.subject, null, null, null);
            for (let i = 0; i < dereferences.length; i++) {
                result.push(rdfFactory.quad(item.subject as NamedNode, rdf.type, dereferences[i].object));
            }

            if (!equals(item.subject, rdf.type)) {
                ctx.dataStore.getInternalStore().newPropertyAction(
                    item.subject as NamedNode,
                    (quad: Quad) => {
                        ctx.store.addQuads([rdfFactory.quad(quad.subject, rdf.type, item.object)]);
                        return true;
                    },
                );
            }
        } else if (equals(rdfs.range, item.predicate)) {
            result.push(rdfFactory.quad(item.subject, rdf.type, rdf.Property));     // P rdf:type rdf:Property
            result.push(rdfFactory.quad(item.object, rdf.type, rdfs.Class));        // C rdf:type rdfs:Class

            const dereferences = ctx.store.match(null, null, item.subject, null);
            for (let i = 0; i < dereferences.length; i++) {
                result.push(rdfFactory.quad(dereferences[i].subject, rdf.type, item.object));
            }

            if (!equals(item.subject, rdf.type)) {
                ctx.dataStore.getInternalStore().newPropertyAction(
                    item.subject as NamedNode,
                    (quad: Quad) => {
                        ctx.store.addQuads([rdfFactory.quad(quad.object, rdf.type, item.object)]);
                        return true;
                    },
                );
            }
        } else if (equals(rdfs.subClassOf, item.predicate)) {            // C1 rdfs:subClassOf C2
            if (!(item.object.termType === TermType.NamedNode || item.object.termType === TermType.BlankNode)) {
                throw new Error("Object of subClassOf statement must be a NamedNode");
            }
            const iSubject = id(item.subject);
            const iObject = id(item.object);
            if (!ctx.superMap.has(iObject)) {
                ctx.superMap.set(iObject, new Set([id(rdfs.Resource)]));
            }

            let parents = ctx.superMap.get(iObject);
            if (parents === undefined) {
                parents = new Set();
                ctx.superMap.set(iObject, parents);
            }
            parents.add(iObject);
            const itemVal = ctx.superMap.get(iSubject) || new Set<number>([iSubject]);

            parents.forEach((i) => itemVal.add(i));

            ctx.superMap.set(iSubject, itemVal);
            ctx.superMap.forEach((v, k) => {
                if (k !== iSubject && v.has(iSubject)) {
                    itemVal.forEach(v.add, v);
                }
            });
        } else if (equals(rdfs.subPropertyOf, item.predicate)) {
            // TODO: Implement
            return result;
        } else if (equals(rdf.type, item.predicate) && equals(rdfs.Datatype, item.object)) {
            /** https://www.w3.org/TR/rdf-schema/#h3_ch_datatype */
            result.push(rdfFactory.quad(item.subject, rdfs.subClassOf, rdfs.Literal));
        }

        return result.length === 1 ? null : result;
    },

    processType(type: NamedNode, ctx: VocabularyProcessingContext): boolean {
        RDFS.processStatement(rdfFactory.quad(type, rdfs.subClassOf, rdfs.Resource), ctx);
        ctx.store.addQuads([rdfFactory.quad(type, rdf.type, rdfs.Class)]);
        return false;
    },
} as VocabularyProcessor;
