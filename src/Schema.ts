import { IndexedFormula, Statement } from "rdflib";
import { RDFStore } from "./RDFStore";

import { OWL } from "./schema/owl";
import { RDFLIB } from "./schema/rdflib";
import { nsRDFSResource, RDFS } from "./schema/rdfs";

import { SomeNode, VocabularyProcessingContext, VocabularyProcessor } from "./types";
import { defaultNS as NS } from "./utilities/constants";
import { DisjointSet } from "./utilities/DisjointSet";
import { namedNodeByStoreIndex } from "./utilities/memoizedNamespace";

/**
 * Implements some RDF/OWL logic to enhance the functionality of the property lookups.
 *
 * Basically duplicates some functionality already present in {IndexedFormula} IIRC, but this API should be more
 * optimized so it can be used in real-time by low-power devices as well.
 */
export class Schema extends IndexedFormula {
    private static vocabularies: VocabularyProcessor[] = [OWL, RDFS, RDFLIB];

    private equivalenceSet: DisjointSet<number> = new DisjointSet();
    private expansionCache: number[][];
    private liveStore: RDFStore;
    private superMap: Map<number, Set<number>> = new Map();
    private processedTypes: number[] = [];

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

    public expand(types: number[]): number[] {
        if (types.length === 1) {
            const existing = this.expansionCache[types[0]];

            return this.expansionCache[types[0]] = existing
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

    public isInstanceOf(resource: number, superClass: number): boolean {
        return this.holdsStatement(new Statement(
            namedNodeByStoreIndex(resource)!,
            NS.rdf("type"),
            namedNodeByStoreIndex(superClass)!,
        ));
    }

    public isSubclassOf(resource: number, superClass: number): boolean {
        const resourceMap = this.superMap.get(resource);

        if (resourceMap) {
            return resourceMap.has(superClass);
        }
        return false;
    }

    /**
     * Returns the hierarchical depth of the type, or -1 if unknown.
     * @param type the type to check
     */
    public superTypeDepth(type: number): number {
        const superMap = this.superMap.get(type);

        return superMap ? superMap.size : -1;
    }

    /**
     * Expands the given lookupTypes to include all their equivalent and subclasses.
     * This is done in multiple iterations until no new types are found.
     * @param lookupTypes The types to look up. Once given, these are assumed to be classes.
     */
    public mineForTypes(lookupTypes: number[]): number[] {
        if (lookupTypes.length === 0) {
            return [nsRDFSResource.sI];
        }

        const canonicalTypes: number[] = [];
        for (let i = 0; i < lookupTypes.length; i++) {
            const canon = (this.liveStore.canon(namedNodeByStoreIndex(lookupTypes[i])!) as SomeNode).sI;
            if (!this.processedTypes.includes(canon)) {
                for (let j = 0; j < Schema.vocabularies.length; j++) {
                    Schema.vocabularies[j].processType(namedNodeByStoreIndex(canon)!, this.getProcessingCtx());
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
                    const superSet = this.superMap.get(b);
                    if (typeof superSet === "undefined") {
                        return a;
                    }

                    superSet.forEach((s) => {
                        if (!a.includes(s)) {
                            a.push(s);
                        }
                    });

                    return a;
                },
                [...lookupTypes],
            );

        return this.sort(allTypes);
    }

    public sort(types: number[]): number[] {
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
