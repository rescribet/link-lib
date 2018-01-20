import { BlankNode, NamedNode, Statement } from "rdflib";

import { VocabularyProcessingContext, VocabularyProcessor } from "../types";
import { defaultNS as NS } from "../utilities";

const nsRDFSClass = NS.rdfs("Class");
const nsRDFSResource = NS.rdfs("Resource");

const nsRDFSsubClassOf = NS.rdfs("subClassOf");
const nsRDFSdomain = NS.rdfs("domain");
const nsRDFSrange = NS.rdfs("range");
const nsRDFSsubPropertyOf = NS.rdfs("subPropertyOf");

/**
 * Implements the RDF/RDFS axioms and rules.
 * @type {VocabularyProcessor}
 */
export const RDFS = {
    axioms: [
        new Statement(NS.rdf("type"), nsRDFSdomain, nsRDFSResource),
        new Statement(nsRDFSdomain, nsRDFSdomain, NS.rdf("Property")),
        new Statement(nsRDFSrange, nsRDFSdomain, NS.rdf("Property")),
        new Statement(nsRDFSsubPropertyOf, nsRDFSdomain, NS.rdf("Property")),
        new Statement(nsRDFSsubClassOf, nsRDFSdomain, nsRDFSClass),
        new Statement(NS.rdf("subject"), nsRDFSdomain, NS.rdf("Statement")),
        new Statement(NS.rdf("predicate"), nsRDFSdomain, NS.rdf("Statement")),
        new Statement(NS.rdf("object"), nsRDFSdomain, NS.rdf("Statement")),
        new Statement(NS.rdfs("member"), nsRDFSdomain, nsRDFSResource),
        new Statement(NS.rdf("first"), nsRDFSdomain, NS.rdf("List")),
        new Statement(NS.rdf("rest"), nsRDFSdomain, NS.rdf("List")),
        new Statement(NS.rdfs("seeAlso"), nsRDFSdomain, nsRDFSResource),
        new Statement(NS.rdfs("isDefinedBy"), nsRDFSdomain, nsRDFSResource),
        new Statement(NS.rdfs("comment"), nsRDFSdomain, nsRDFSResource),
        new Statement(NS.rdfs("label"), nsRDFSdomain, nsRDFSResource),
        new Statement(NS.rdf("value"), nsRDFSdomain, nsRDFSResource),

        new Statement(NS.rdf("type"), nsRDFSrange, nsRDFSClass),
        new Statement(nsRDFSdomain, nsRDFSrange, nsRDFSClass),
        new Statement(nsRDFSrange, nsRDFSrange, nsRDFSClass),
        new Statement(nsRDFSsubPropertyOf, nsRDFSrange, NS.rdf("Property")),
        new Statement(nsRDFSsubClassOf, nsRDFSrange, nsRDFSClass),
        new Statement(NS.rdf("subject"), nsRDFSrange, nsRDFSResource),
        new Statement(NS.rdf("predicate"), nsRDFSrange, nsRDFSResource),
        new Statement(NS.rdf("object"), nsRDFSrange, nsRDFSResource),
        new Statement(NS.rdfs("member"), nsRDFSrange, nsRDFSResource),
        new Statement(NS.rdf("first"), nsRDFSrange, nsRDFSResource),
        new Statement(NS.rdf("rest"), nsRDFSrange, NS.rdf("List")),
        new Statement(NS.rdfs("seeAlso"), nsRDFSrange, nsRDFSResource),
        new Statement(NS.rdfs("isDefinedBy"), nsRDFSrange, nsRDFSResource),
        new Statement(NS.rdfs("comment"), nsRDFSrange, NS.rdfs("Literal")),
        new Statement(NS.rdfs("label"), nsRDFSrange, NS.rdfs("Literal")),
        new Statement(NS.rdf("value"), nsRDFSrange, nsRDFSResource),

        new Statement(NS.rdf("Alt"), nsRDFSsubClassOf, NS.rdfs("Container")),
        new Statement(NS.rdf("Bag"), nsRDFSsubClassOf, NS.rdfs("Container")),
        new Statement(NS.rdf("Seq"), nsRDFSsubClassOf, NS.rdfs("Container")),
        new Statement(NS.rdfs("ContainerMembershipProperty"), nsRDFSsubClassOf, NS.rdf("Property")),

        new Statement(NS.rdfs("isDefinedBy"), nsRDFSsubPropertyOf, NS.rdfs("seeAlso")),

        new Statement(NS.rdfs("Datatype"), nsRDFSsubClassOf, nsRDFSClass),

        new Statement(nsRDFSResource, NS.rdf("type"), nsRDFSClass),
        new Statement(nsRDFSClass, NS.rdf("type"), nsRDFSClass),
    ],

    processStatement(item: Statement, ctx: VocabularyProcessingContext): Statement[] | null {
        const result = [item];

        const domainStatements = ctx.store.statementsMatching(item.predicate, nsRDFSdomain);
        if (domainStatements.length > 0) {
            domainStatements.forEach(({ object }) => {
                result.push(new Statement(item.subject as NamedNode, NS.rdf("type"), object));
            });
        }

        const rangeStatements = ctx.store.statementsMatching(item.predicate, nsRDFSrange);
        if (rangeStatements.length > 0) {                                                     // P rdfs:range C..Cn
            rangeStatements.forEach(({ object }) => {
                result.push(new Statement(item.object as NamedNode, NS.rdf("type"), object));
            });
        }

        if (nsRDFSdomain.equals(item.predicate)) {
            if (!(item.object instanceof NamedNode)) {
                throw new TypeError(`A non IRI was passed as object to rdfs:domain (was: ${item.object}).`);
            }
            result.push(new Statement(item.subject, NS.rdf("type"), NS.rdf("Property")));     // P rdf:type rdf:Property
            result.push(new Statement(item.object, NS.rdf("type"), NS.rdfs("Class")));        // C rdf:type rdfs:Class

            const dereferences = ctx.store.statementsMatching(item.subject);
            for (const { object } of dereferences) {
                result.push(new Statement(item.subject as NamedNode, NS.rdf("type"), object));
            }
        } else if (nsRDFSrange.equals(item.predicate)) {
            if (!(item.object instanceof NamedNode)) {
                throw new TypeError(`A non IRI was passed as object to rdfs:domain (was: ${item.object}).`);
            }
            result.push(new Statement(item.subject, NS.rdf("type"), NS.rdf("Property")));     // P rdf:type rdf:Property
            result.push(new Statement(item.object, NS.rdf("type"), NS.rdfs("Class")));        // C rdf:type rdfs:Class

            const dereferences = ctx.store.statementsMatching(undefined, undefined, item.subject);
            for (const { subject } of dereferences) {
                result.push(new Statement(subject, NS.rdf("type"), item.object));
            }
        } else if (nsRDFSsubClassOf.equals(item.predicate)) {                                   // C1 rdfs:subClassOf C2
            if (!(item.object instanceof NamedNode || item.object instanceof BlankNode)) {
                throw new Error("Object of subClassOf statement must be a NamedNode");
            }
            const sSubject = item.subject.value;
            const sObject = item.object.value;
            if (!ctx.superMap.has(sObject)) {
                ctx.superMap.set(sObject, new Set([nsRDFSResource.value]));
            }

            const parents = ctx.superMap.get(sObject) || new Set<string>([item.object.value]);
            const itemVal = ctx.superMap.get(sSubject) || new Set<string>([item.subject.value]);

            parents.forEach((i) => itemVal.add(i));

            ctx.superMap.set(sSubject, itemVal);
            ctx.superMap.forEach((v, k) => {
                if (k !== sSubject && v.has(item.subject.value)) {
                    itemVal.forEach(v.add, v);
                }
            });
        } else if (nsRDFSsubPropertyOf.equals(item.predicate)) {
            // TODO: Implement
            return result;
        }

        return result.length === 1 ? null : result;
    },

    processType(_: NamedNode, __: VocabularyProcessingContext): boolean {
        // RDFS.processStatement(new Statement(type, nsRDFSsubClassOf, nsRDFSResource), _, superMap);
        // RDFS.processStatement(new Statement(type, nsRDFSsubClassOf, nsRDFSClass), _, superMap);
        return false;
    },
} as VocabularyProcessor;
