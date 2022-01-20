import rdfFactory, {NamedNode, QuadPosition, Quadruple, TermType} from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";

import { equals, id } from "../factoryHelpers";
import { VocabularyProcessingContext, VocabularyProcessor } from "../types";

const defaultGraph: NamedNode = rdfFactory.defaultGraph();

/**
 * Implements the RDF/RDFS axioms and rules.
 * @type {VocabularyProcessor}
 */
export const RDFS = {
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

    processStatement(item: Quadruple, ctx: VocabularyProcessingContext): Quadruple[] | null {
        const result: Quadruple[] = [item];

        const domainStatements = ctx.store.match(item[QuadPosition.predicate], rdfs.domain, null);
        if (domainStatements.length > 0) {
            for (let i = 0; i < domainStatements.length; i++) {
                result.push([
                    item[QuadPosition.subject],
                    rdf.type,
                    domainStatements[i][QuadPosition.object],
                    defaultGraph,
                ]);
            }
        }

        const rangeStatements = ctx.store.match(item[QuadPosition.predicate], rdfs.range, null);
        if (rangeStatements.length > 0) {                                                     // P rdfs:range C..Cn
            for (let i = 0; i < rangeStatements.length; i++) {
                result.push([
                    item[QuadPosition.object] as NamedNode,
                    rdf.type,
                    rangeStatements[i][QuadPosition.object],
                    defaultGraph,
                ]);
            }
        }

        if (equals(rdfs.domain, item[QuadPosition.predicate])) {
            result.push([item[QuadPosition.subject], rdf.type, rdf.Property, defaultGraph]); // P rdf:type rdf:Property
            result.push([
                item[QuadPosition.object] as NamedNode,
                rdf.type,
                rdfs.Class,
                defaultGraph,
            ]);    // C rdf:type rdfs:Class

            const dereferences = ctx.store.match(item[QuadPosition.subject], null, null);
            for (let i = 0; i < dereferences.length; i++) {
                result.push([
                    item[QuadPosition.subject] as NamedNode,
                    rdf.type,
                    dereferences[i][QuadPosition.object],
                    defaultGraph,
                ]);
            }

            if (!equals(item[QuadPosition.subject], rdf.type)) {
                ctx.dataStore.getInternalStore().newPropertyAction(
                    item[QuadPosition.subject] as NamedNode,
                    (quad: Quadruple) => {
                        ctx.store.addQuads([
                            [quad[QuadPosition.subject], rdf.type, item[QuadPosition.object], defaultGraph],
                        ]);
                        return true;
                    },
                );
            }
        } else if (equals(rdfs.range, item[QuadPosition.predicate])) {
            result.push([item[QuadPosition.subject], rdf.type, rdf.Property, defaultGraph]); // P rdf:type rdf:Property
            result.push([
                item[QuadPosition.object] as NamedNode,
                rdf.type,
                rdfs.Class,
                defaultGraph,
            ]); // C rdf:type rdfs:Class

            const dereferences = ctx.store.match(null, null, item[QuadPosition.subject]);
            for (let i = 0; i < dereferences.length; i++) {
                result.push([dereferences[i][QuadPosition.subject], rdf.type, item[QuadPosition.object], defaultGraph]);
            }

            if (!equals(item[QuadPosition.subject], rdf.type)) {
                ctx.dataStore.getInternalStore().newPropertyAction(
                    item[QuadPosition.subject] as NamedNode,
                    (quad: Quadruple) => {
                        const subject = quad[QuadPosition.object];
                        if (subject.termType !== TermType.Literal) {
                            ctx.store.addQuads([[
                                subject,
                                rdf.type,
                                item[QuadPosition.object],
                                defaultGraph,
                            ]]);
                        }
                        return true;
                    },
                );
            }
        } else if (equals(rdfs.subClassOf, item[QuadPosition.predicate])) {            // C1 rdfs:subClassOf C2
            const objectType = item[QuadPosition.object].termType;
            if (!(objectType === TermType.NamedNode || objectType === TermType.BlankNode)) {
                throw new Error("Object of subClassOf statement must be a NamedNode");
            }

            const iSubject = id(item[QuadPosition.subject]);
            const iObject = id(item[QuadPosition.object]);
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
        } else if (equals(rdfs.subPropertyOf, item[QuadPosition.predicate])) {
            // TODO: Implement
            return result;
        }

        return result.length === 1 ? null : result;
    },

    processType(type: NamedNode, ctx: VocabularyProcessingContext): boolean {
        RDFS.processStatement([type, rdfs.subClassOf, rdfs.Resource, defaultGraph], ctx);
        ctx.store.addQuads([[type, rdf.type, rdfs.Class, defaultGraph]]);
        return false;
    },
} as VocabularyProcessor;
