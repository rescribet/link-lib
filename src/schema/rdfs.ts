import rdfFactory, { NamedNode, Quad, TermType } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import { Term } from "../rdf";
import { Store } from "../rdflib";

import { SomeNode, VocabularyProcessingContext, VocabularyProcessor } from "../types";

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

        rdfFactory.quad(rdfs.Datatype, rdfs.subClassOf, rdfs.Class),

        rdfFactory.quad(rdfs.Resource, rdf.type, rdfs.Class),
        rdfFactory.quad(rdfs.Class, rdf.type, rdfs.Class),
    ],

    processStatement(item: Quad, ctx: VocabularyProcessingContext): Quad[] | null {
        const result = [item];

        const domainStatements = ctx.store.statementsMatching(item.predicate, rdfs.domain);
        if (domainStatements.length > 0) {
            for (let i = 0; i < domainStatements.length; i++) {
                result.push(rdfFactory.quad(item.subject as NamedNode, rdf.type, domainStatements[i].object));
            }
        }

        const rangeStatements = ctx.store.statementsMatching(item.predicate, rdfs.range);
        if (rangeStatements.length > 0) {                                                     // P rdfs:range C..Cn
            for (let i = 0; i < rangeStatements.length; i++) {
                result.push(rdfFactory.quad(item.object as NamedNode, rdf.type, rangeStatements[i].object));
            }
        }

        if (rdfFactory.equals(rdfs.domain, item.predicate)) {
            result.push(rdfFactory.quad(item.subject, rdf.type, rdf.Property));     // P rdf:type rdf:Property
            result.push(rdfFactory.quad(item.object, rdf.type, rdfs.Class));        // C rdf:type rdfs:Class

            const dereferences = ctx.store.statementsMatching(item.subject);
            for (let i = 0; i < dereferences.length; i++) {
                result.push(rdfFactory.quad(item.subject as NamedNode, rdf.type, dereferences[i].object));
            }

            if (!rdfFactory.equals(item.subject, rdf.type)) {
                ctx.dataStore.getInternalStore().newPropertyAction(
                    item.subject as NamedNode,
                    (_: Store, subj: SomeNode) => {
                        ctx.store.addStatements([rdfFactory.quad(subj, rdf.type, item.object)]);
                        return true;
                    },
                );
            }
        } else if (rdfFactory.equals(rdfs.range, item.predicate)) {
            result.push(rdfFactory.quad(item.subject, rdf.type, rdf.Property));     // P rdf:type rdf:Property
            result.push(rdfFactory.quad(item.object, rdf.type, rdfs.Class));        // C rdf:type rdfs:Class

            const dereferences = ctx.store.statementsMatching(undefined, undefined, item.subject);
            for (let i = 0; i < dereferences.length; i++) {
                result.push(rdfFactory.quad(dereferences[i].subject, rdf.type, item.object));
            }

            if (!rdfFactory.equals(item.subject, rdf.type)) {
                ctx.dataStore.getInternalStore().newPropertyAction(
                    item.subject as NamedNode,
                    (_: Store, __: SomeNode, ___, obj: Term) => {
                        ctx.store.addStatements([rdfFactory.quad(obj, rdf.type, item.object)]);
                        return true;
                    },
                );
            }
        } else if (rdfFactory.equals(rdfs.subClassOf, item.predicate)) {            // C1 rdfs:subClassOf C2
            if (!(item.object.termType === TermType.NamedNode || item.object.termType === TermType.BlankNode)) {
                throw new Error("Object of subClassOf statement must be a NamedNode");
            }
            const iSubject = rdfFactory.id(item.subject) as number;
            const iObject = rdfFactory.id(item.object) as number;
            if (!ctx.superMap.has(iObject)) {
                ctx.superMap.set(iObject, new Set([rdfFactory.id(rdfs.Resource) as number]));
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
        } else if (rdfFactory.equals(rdfs.subPropertyOf, item.predicate)) {
            // TODO: Implement
            return result;
        }

        return result.length === 1 ? null : result;
    },

    processType(type: NamedNode, ctx: VocabularyProcessingContext): boolean {
        RDFS.processStatement(rdfFactory.quad(type, rdfs.subClassOf, rdfs.Resource), ctx);
        ctx.store.add(rdfFactory.quad(type, rdf.type, rdfs.Class));
        return false;
    },
} as VocabularyProcessor;
