import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";

import rdfFactory, { NamedNode, Quad, SomeTerm } from "./rdf";
import { IndexedFormula } from "./rdflib";
import { RDFStore } from "./RDFStore";
import { OWL } from "./schema/owl";
import { RDFLIB } from "./schema/rdflib";
import { RDFS } from "./schema/rdfs";

import {
    Indexable,
    VocabularyProcessingContext,
    VocabularyProcessor,
} from "./types";
import { DisjointSet } from "./utilities/DisjointSet";

/**
 * Implements some RDF/OWL logic to enhance the functionality of the property lookups.
 *
 * Basically duplicates some functionality already present in {IndexedFormula} IIRC, but this API should be more
 * optimized so it can be used in real-time by low-power devices as well.
 */
export class Schema<IndexType = number | string> extends IndexedFormula {
    private static vocabularies: VocabularyProcessor[] = [OWL, RDFS, RDFLIB];

    private equivalenceSet: DisjointSet<Indexable> = new DisjointSet();
    private expansionCache: { [k: string]: Indexable[] };
    private liveStore: RDFStore;
    private superMap: Map<Indexable, Set<Indexable>> = new Map();
    private processedTypes: Indexable[] = [];

    public constructor(liveStore: RDFStore) {
        super(undefined, { rdfFactory });
        this.liveStore = liveStore;
        this.expansionCache = {};
        this.rdfFactory = rdfFactory;

        for (let i = 0; i < Schema.vocabularies.length; i++) {
            this.addStatements(Schema.vocabularies[i].axioms);
        }
    }

    /** Push statements onto the graph so it can be used by the render store for component determination. */
    public addStatements(statements: Quad[]): void {
        const unique = statements.filter((s) => !this.holdsStatement(s));
        const eligible = unique.filter(this.process.bind(this));
        if (eligible.length === 0) {
            return;
        }

        this.addAll(eligible);
        return this.liveStore.addStatements(eligible);
    }

    public expand(types: Indexable[]): IndexType[] {
        if (types.length === 1) {
            const existing = this.expansionCache[types[0] as unknown as string];
            this.expansionCache[types[0] as unknown as string] = existing
                ? existing
                : this.sort(this.mineForTypes(types) as unknown as Indexable[]) as unknown as Indexable[];

            return this.expansionCache[types[0] as unknown as string] as unknown as IndexType[];
        }

        return this.sort(this.mineForTypes(types) as unknown as Indexable[]);
    }

    public getProcessingCtx(): VocabularyProcessingContext {
        return {
            dataStore: this.liveStore,
            equivalenceSet: this.equivalenceSet,
            store: this,
            superMap: this.superMap,
        };
    }

    public isInstanceOf(resource: Indexable, superClass: Indexable): boolean {
        return this.holdsStatement(rdfFactory.quad(
            rdfFactory.fromId(resource) as NamedNode,
            rdf.type,
            rdfFactory.fromId(superClass) as SomeTerm,
        ));
    }

    public isSubclassOf(resource: Indexable, superClass: Indexable): boolean {
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
    public superTypeDepth(type: Indexable): number {
        const superMap = this.superMap.get(type);

        return superMap ? superMap.size : -1;
    }

    /**
     * Expands the given lookupTypes to include all their equivalent and subclasses.
     * This is done in multiple iterations until no new types are found.
     * @param lookupTypes The types to look up. Once given, these are assumed to be classes.
     */
    public mineForTypes(lookupTypes: Indexable[]): IndexType[] {
        if (lookupTypes.length === 0) {
            return [rdfFactory.id(rdfs.Resource) as unknown as IndexType];
        }

        const canonicalTypes: Indexable[] = [];
        for (let i = 0; i < lookupTypes.length; i++) {
            const canon = rdfFactory.id(
                this.liveStore.canon(
                    rdfFactory.fromId(lookupTypes[i]) as NamedNode,
                ),
            ) as unknown as Indexable;

            if (!this.processedTypes.includes(canon)) {
                for (let j = 0; j < Schema.vocabularies.length; j++) {
                    Schema.vocabularies[j].processType(
                        rdfFactory.fromId(canon) as NamedNode,
                        this.getProcessingCtx(),
                    );
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

    public sort(types: Indexable[]): IndexType[] {
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
        }) as unknown as IndexType[];
    }

    private process(item: Quad): Quad[] | null {
        for (let i = 0; i < Schema.vocabularies.length; i++) {
            const res = Schema.vocabularies[i].processStatement(item, this.getProcessingCtx());
            if (res !== null) {
                return res;
            }
        }

        return null;
    }
}
