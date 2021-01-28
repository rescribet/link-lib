import rdfFactory, { NamedNode, Quad } from "@ontologies/core";
import { sameAs } from "@ontologies/owl";

import { SomeNode, VocabularyProcessingContext, VocabularyProcessor } from "../types";

/*
 * TODO: Basically all of them...
 */
// const nsOWLAllDifferent = NS.owl("AllDifferent");
// const nsOWLAllDisjointClasses = NS.owl("AllDisjointClasses");
// const nsOWLAllDisjointProperties = NS.owl("AllDisjointProperties");
// const nsOWLallValuesFrom = NS.owl("allValuesFrom");
// const nsOWLannotatedProperty = NS.owl("annotatedProperty");
// const nsOWLannotatedSource = NS.owl("annotatedSource");
// const nsOWLannotatedTarget = NS.owl("annotatedTarget");
// const nsOWLAnnotation = NS.owl("Annotation");
// const nsOWLAnnotationProperty = NS.owl("AnnotationProperty");
// const nsOWLassertionProperty = NS.owl("assertionProperty");
// const nsOWLAsymmetricProperty = NS.owl("AsymmetricProperty");
// const nsOWLAxiom = NS.owl("Axiom");
// const nsOWLbackwardCompatibleWith = NS.owl("backwardCompatibleWith");
// const nsOWLbottomDataProperty = NS.owl("bottomDataProperty");
// const nsOWLbottomObjectProperty = NS.owl("bottomObjectProperty");
// const nsOWLcardinality = NS.owl("cardinality");
// const nsOWLClass = NS.owl("Class");
// const nsOWLcomplementOf = NS.owl("complementOf");
// const nsOWLDataRange = NS.owl("DataRange");
// const nsOWLdatatypeComplementOf = NS.owl("datatypeComplementOf");
// const nsOWLDatatypeProperty = NS.owl("DatatypeProperty");
// const nsOWLdeprecated = NS.owl("deprecated");
// const nsOWLDeprecatedClass = NS.owl("DeprecatedClass");
// const nsOWLDeprecatedProperty = NS.owl("DeprecatedProperty");
// const nsOWLdifferentFrom = NS.owl("differentFrom");
// const nsOWLdisjointUnionOf = NS.owl("disjointUnionOf");
// const nsOWLdisjointWith = NS.owl("disjointWith");
// const nsOWLdistinctMembers = NS.owl("distinctMembers");
// const nsOWLequivalentClass = NS.owl("equivalentClass");
// const nsOWLequivalentProperty = NS.owl("equivalentProperty");
// const nsOWLFunctionalProperty = NS.owl("FunctionalProperty");
// const nsOWLhasKey = NS.owl("hasKey");
// const nsOWLhasSelf = NS.owl("hasSelf");
// const nsOWLhasValue = NS.owl("hasValue");
// const nsOWLimports = NS.owl("imports");
// const nsOWLincompatibleWith = NS.owl("incompatibleWith");
// const nsOWLintersectionOf = NS.owl("intersectionOf");
// const nsOWLInverseFunctionalProperty = NS.owl("InverseFunctionalProperty");
// const nsOWLinverseOf = NS.owl("inverseOf");
// const nsOWLIrreflexiveProperty = NS.owl("IrreflexiveProperty");
// const nsOWLmaxCardinality = NS.owl("maxCardinality");
// const nsOWLmaxQualifiedCardinality = NS.owl("maxQualifiedCardinality");
// const nsOWLmembers = NS.owl("members");
// const nsOWLminCardinality = NS.owl("minCardinality");
// const nsOWLminQualifiedCardinality = NS.owl("minQualifiedCardinality");
// const nsOWLNamedIndividual = NS.owl("NamedIndividual");
// const nsOWLNegativePropertyAssertion = NS.owl("NegativePropertyAssertion");
// const nsOWLNothing = NS.owl("Nothing");
// const nsOWLObjectProperty = NS.owl("ObjectProperty");
// const nsOWLonClass = NS.owl("onClass");
// const nsOWLonDataRange = NS.owl("onDataRange");
// const nsOWLonDatatype = NS.owl("onDatatype");
// const nsOWLoneOf = NS.owl("oneOf");
// const nsOWLonProperty = NS.owl("onProperty");
// const nsOWLonProperties = NS.owl("onProperties");
// const nsOWLOntology = NS.owl("Ontology");
// const nsOWLOntologyProperty = NS.owl("OntologyProperty");
// const nsOWLpriorVersion = NS.owl("priorVersion");
// const nsOWLpropertyChainAxiom = NS.owl("propertyChainAxiom");
// const nsOWLpropertyDisjointWith = NS.owl("propertyDisjointWith");
// const nsOWLqualifiedCardinality = NS.owl("qualifiedCardinality");
// const nsOWLReflexiveProperty = NS.owl("ReflexiveProperty");
// const nsOWLRestriction = NS.owl("Restriction");
const nsOWLsameAs = sameAs;
// const nsOWLsomeValuesFrom = NS.owl("someValuesFrom");
// const nsOWLsourceIndividual = NS.owl("sourceIndividual");
// const nsOWLSymmetricProperty = NS.owl("SymmetricProperty");
// const nsOWLtargetIndividual = NS.owl("targetIndividual");
// const nsOWLtargetValue = NS.owl("targetValue");
// const nsOWLThing = NS.owl("Thing");
// const nsOWLtopDataProperty = NS.owl("topDataProperty");
// const nsOWLtopObjectProperty = NS.owl("topObjectProperty");
// const nsOWLTransitiveProperty = NS.owl("TransitiveProperty");
// const nsOWLunionOf = NS.owl("unionOf");
// const nsOWLversionInfo = NS.owl("versionInfo");
// const nsOWLversionIRI = NS.owl("versionIRI");
// const nsOWLwithRestrictions = NS.owl("withRestrictions");

export const OWL = {
    axioms: [],

    processStatement(item: Quad, ctx: VocabularyProcessingContext): Quad[] | null {
        if (rdfFactory.equals(item.predicate, nsOWLsameAs)) {
            const a = ctx.equivalenceSet.add((item.object as SomeNode).id as number);
            const b = ctx.equivalenceSet.add(item.subject.id as number);
            ctx.equivalenceSet.union(a, b);

            return [item];
        }

        return null;
    },

    processType(_: NamedNode, __: VocabularyProcessingContext): boolean {
        return false;
    },
} as VocabularyProcessor;
