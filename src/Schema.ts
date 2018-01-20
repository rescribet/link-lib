import { IndexedFormula, NamedNode, SomeTerm, Statement } from "rdflib";
import { RDFStore } from "./RDFStore";

import { OWL } from "./schema/owl";
import { RDFS } from "./schema/rdfs";

import { VocabularyProcessingContext, VocabularyProcessor } from "./types";
import { defaultNS as NS } from "./utilities";
import { DisjointSet } from "./utilities/DisjointSet";

/**
 * Implements some RDF/OWL logic to enhance the functionality of the property lookups.
 *
 * Basically duplicates some functionality already present in {IndexedFormula} IIRC, but this API should be more
 * optimized so it can be used in real-time by low-power devices as well.
 */
export class Schema extends IndexedFormula {
    private static vocabularies: VocabularyProcessor[] = [OWL, RDFS];

    private equivalenceSet: DisjointSet<SomeTerm> = new DisjointSet();
    private liveStore: RDFStore;
    private superMap: Map<string, Set<string>> = new Map();
    private processedTypes: NamedNode[] = [];

    public constructor(liveStore: RDFStore) {
        super();
        this.liveStore = liveStore;

        for (const vocab of Schema.vocabularies) {
            this.addStatements(vocab.axioms);
        }
    }

    public addStatement(st: Statement): void {
        this.addStatements([st]);
    }

    /** Push statements onto the graph so it can be used by the render store for component determination. */
    public addStatements(statements: Statement[]): void {
        const unique = statements.filter((s) => !this.holdsStatement(s));
        const eligible = unique.filter(this.process.bind(this));
        if (eligible.length === 0) {
            return;
        }

        this.addAll(eligible);
        return this.addStatements(eligible);
    }

    public getProcessingCtx(): VocabularyProcessingContext {
        return {
            equivalenceSet: this.equivalenceSet,
            store: this,
            superMap: this.superMap,
        };
    }

    public isInstanceOf(resource: NamedNode, superClass: NamedNode): boolean {
        return this.holdsStatement(new Statement(resource, NS.rdf("type"), superClass));
    }

    public isSubclassOf(resource: NamedNode, superClass: NamedNode): boolean {
        const resourceMap = this.superMap.get(resource.value);

        return !!(resourceMap && resourceMap.has(superClass.value));
    }

    /**
     * Expands the given lookupTypes to include all their equivalent and subclasses.
     * This is done in multiple iterations until no new types are found.
     * @param lookupTypes The types to look up.
     */
    public mineForTypes(lookupTypes: NamedNode[]): NamedNode[] {
        const reduced = lookupTypes
            .map((v) => {
                const canon = this.liveStore.canon(v) as NamedNode;
                if (!this.processedTypes.includes(canon)) {
                    for (const vocab of Schema.vocabularies) {
                        vocab.processType(canon, this.getProcessingCtx());
                    }
                    this.processedTypes.push(canon);
                }

                return canon;
            })
            .reduce(
                (a, b) => {
                    const superSet = this.superMap.get(b.value);
                    if (typeof superSet === "undefined") {
                        return a;
                    }

                    return a.concat(Array.from(superSet).map((s) => new NamedNode(s)));
                },
                lookupTypes,
            );

        return reduced.concat([NS.rdfs("Resource")]);
    }

    private process(item: Statement): Statement[] | null {
        for (const vocab of Schema.vocabularies) {
            const res = vocab.processStatement(item, this.getProcessingCtx());
            if (res !== null) {
                return res;
            }
        }

        return null;
    }
}
