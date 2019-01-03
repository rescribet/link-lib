import { IndexedFormula, NamedNode, SomeTerm, Statement } from "rdflib";
import { RDFStore } from "./RDFStore";

import { OWL } from "./schema/owl";
import { RDFLIB } from "./schema/rdflib";
import { nsRDFSResource, RDFS } from "./schema/rdfs";

import { VocabularyProcessingContext, VocabularyProcessor } from "./types";
import { defaultNS as NS } from "./utilities/constants";
import { DisjointSet } from "./utilities/DisjointSet";
import { namedNodeByIRI } from "./utilities/memoizedNamespace";

/**
 * Implements some RDF/OWL logic to enhance the functionality of the property lookups.
 *
 * Basically duplicates some functionality already present in {IndexedFormula} IIRC, but this API should be more
 * optimized so it can be used in real-time by low-power devices as well.
 */
export class Schema extends IndexedFormula {
    private static vocabularies: VocabularyProcessor[] = [OWL, RDFS, RDFLIB];

    private equivalenceSet: DisjointSet<SomeTerm> = new DisjointSet();
    private expansionCache: NamedNode[][];
    private liveStore: RDFStore;
    private superMap: Map<string, Set<string>> = new Map();
    private processedTypes: NamedNode[] = [];

    public constructor(liveStore: RDFStore) {
        super();
        this.liveStore = liveStore;
        this.expansionCache = [];

        for (let i = 0; i < Schema.vocabularies.length; i++) {
            this.addStatements(Schema.vocabularies[i].axioms);
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

    public expand(types: NamedNode[]): NamedNode[] {
        if (types.length === 1) {
            const existing = this.expansionCache[types[0].sI];

            return this.expansionCache[types[0].sI] = existing
                ? existing
                : this.sort(this.mineForTypes(types));
        }

        return this.sort(this.mineForTypes(types));
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

        if (resourceMap) {
            return resourceMap.has(superClass.value);
        }
        return false;
    }

    /**
     * Returns the hierarchical depth of the type, or -1 if unknown.
     * @param type the type to check
     */
    public superTypeDepth(type: NamedNode): number {
        const superMap = this.superMap.get(type.value);

        return superMap ? superMap.size : -1;
    }

    /**
     * Expands the given lookupTypes to include all their equivalent and subclasses.
     * This is done in multiple iterations until no new types are found.
     * @param lookupTypes The types to look up. Once given, these are assumed to be classes.
     */
    public mineForTypes(lookupTypes: NamedNode[]): NamedNode[] {
        if (lookupTypes.length === 0) {
            return [nsRDFSResource];
        }

        const canonicalTypes: NamedNode[] = [];
        for (let i = 0; i < lookupTypes.length; i++) {
            const canon = this.liveStore.canon(lookupTypes[i]) as NamedNode;
            if (!this.processedTypes.includes(canon)) {
                for (let j = 0; j < Schema.vocabularies.length; j++) {
                    Schema.vocabularies[j].processType(canon, this.getProcessingCtx());
                }
                this.processedTypes.push(canon);
            }

            if (!canonicalTypes.includes(canon)) {
                canonicalTypes.push(canon);
            }
        }

        const allTypes = canonicalTypes
            .reduce(
                (a, b) => {
                    const superSet = this.superMap.get(b.value);
                    if (typeof superSet === "undefined") {
                        return a;
                    }

                    superSet.forEach((s) => {
                        const nn = namedNodeByIRI(s);
                        if (!a.includes(nn)) {
                            a.push(nn);
                        }
                    });

                    return a;
                },
                [...lookupTypes],
            );

        return this.sort(allTypes);
    }

    public sort(types: NamedNode[]): NamedNode[] {
        return types.sort((a, b) => {
            if (this.isSubclassOf(a, b)) {
                return -1;
            } else if (this.isSubclassOf(b, a)) {
                return 1;
            }

            const aDepth = this.superTypeDepth(a);
            const bDepth = this.superTypeDepth(b);
            if (aDepth < bDepth) {
                return 1;
            } else if (aDepth > bDepth) {
                return -1;
            }

            return 0;
        });
    }

    private process(item: Statement): Statement[] | null {
        for (let i = 0; i < Schema.vocabularies.length; i++) {
            const res = Schema.vocabularies[i].processStatement(item, this.getProcessingCtx());
            if (res !== null) {
                return res;
            }
        }

        return null;
    }
}
