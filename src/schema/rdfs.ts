import rdfFactory, {NamedNode, QuadPosition, Quadruple, TermType} from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";

import { equals, id } from "../factoryHelpers";
import { DataRecord } from "../store/StructuredStore";
import { SomeNode, VocabularyProcessingContext, VocabularyProcessor } from "../types";

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
        const dataStore = ctx.dataStore.getInternalStore().store;
        const result: Quadruple[] = [item];

        const domainValues = dataStore.getField(item[QuadPosition.predicate].value, rdfs.domain.value);
        if (domainValues !== undefined) {
            if (Array.isArray(domainValues)) {
                for (let i = 0; i < domainValues.length; i++) {
                    result.push([
                        item[QuadPosition.subject],
                        rdf.type,
                        domainValues[i],
                        defaultGraph,
                    ]);
                }
            } else {
                result.push([
                    item[QuadPosition.subject],
                    rdf.type,
                    domainValues,
                    defaultGraph,
                ]);
            }
        }

        const rangeValues = dataStore.getField(item[QuadPosition.predicate].value, rdfs.range.value);
        if (rangeValues !== undefined) {                                                     // P rdfs:range C..Cn
            if (Array.isArray(rangeValues)) {
                for (let i = 0; i < rangeValues.length; i++) {
                    result.push([
                        item[QuadPosition.object] as NamedNode,
                        rdf.type,
                        rangeValues[i],
                        defaultGraph,
                    ]);
                }
            } else {
                result.push([
                    item[QuadPosition.object] as NamedNode,
                    rdf.type,
                    rangeValues,
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

            const record = dataStore.getRecord(item[QuadPosition.subject].value);
            if (record !== undefined) {
                const entries = Object.values(record);
                for (const field in record) {
                    if (!record.hasOwnProperty(field)) {
                        continue;
                    }

                    for (const value of entries) {
                        if (Array.isArray(value)) {
                            for (const v of value) {
                                result.push([
                                    item[QuadPosition.subject] as NamedNode,
                                    rdf.type,
                                    v,
                                    defaultGraph,
                                ]);
                            }
                        } else {
                            result.push([
                                item[QuadPosition.subject] as NamedNode,
                                rdf.type,
                                value,
                                defaultGraph,
                            ]);
                        }
                    }
                }
            }

            if (!equals(item[QuadPosition.subject], rdf.type)) {
                ctx.dataStore.getInternalStore().newPropertyAction(
                    item[QuadPosition.subject] as NamedNode,
                    (updated: DataRecord) => {
                        ctx.dataStore.add(
                            updated._id,
                            rdf.type,
                            item[QuadPosition.object],
                        );
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

            const dereferences = ctx.dataStore.references(item[QuadPosition.subject]);
            for (let i = 0; i < dereferences.length; i++) {
                let s: SomeNode;
                if (dereferences[i].includes("/")) {
                    s = rdfFactory.namedNode(dereferences[i]);
                } else {
                    s = rdfFactory.blankNode(dereferences[i]);
                }
                result.push([s, rdf.type, item[QuadPosition.object], defaultGraph]);
            }

            if (!equals(item[QuadPosition.subject], rdf.type)) {
                const predicate = item[QuadPosition.subject] as NamedNode;
                const range = item[QuadPosition.object];

                ctx.dataStore.getInternalStore().newPropertyAction(
                    predicate,
                    (updated: DataRecord) => {
                        const subject = updated[predicate.value];
                        if (Array.isArray(subject)) {
                            for (const s of subject) {
                                if (s.termType !== TermType.Literal) {
                                    ctx.dataStore.add(s, rdf.type, range);
                                }
                            }
                        } else {
                            if (subject.termType !== TermType.Literal) {
                                ctx.dataStore.add(subject, rdf.type, range);
                            }
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
        return false;
    },
} as VocabularyProcessor;
