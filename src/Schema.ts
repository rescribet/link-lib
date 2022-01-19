import rdfFactory, { NamedNode, Quad, SomeTerm } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";
import { id } from "./factoryHelpers";
import RDFIndex from "./store/RDFIndex";

import { RDFStore } from "./RDFStore";
import { OWL } from "./schema/owl";
import { RDFS } from "./schema/rdfs";

import {
    SomeNode,
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
export class Schema<IndexType = number | string> {
    private static vocabularies: VocabularyProcessor[] = [OWL, RDFS];

    private equivalenceSet: DisjointSet<IndexType> = new DisjointSet();
    // Typescript can't handle generic index types, so it is set to string.
    private expansionCache: { [k: string]: IndexType[] };
    private store: RDFIndex;
    private liveStore: RDFStore;
    private superMap: Map<IndexType, Set<IndexType>> = new Map();
    private processedTypes: IndexType[] = [];

    public constructor(liveStore: RDFStore) {
        this.liveStore = liveStore;
        this.store = new RDFIndex();
        this.liveStore.getInternalStore().addDataCallback(this.process.bind(this));
        this.expansionCache = {};

        for (let i = 0; i < Schema.vocabularies.length; i++) {
            this.addQuads(Schema.vocabularies[i].axioms);
        }
    }

    /**
     * Push quads onto the graph so it can be used by the render store for component determination.
     * @return The quads added to the store.
     */
    public addQuads(quads: Quad[]): Quad[] {
        const unique = quads.filter((s) => !this.store.holdsQuad(s));
        const eligible = unique.filter(this.process.bind(this));
        if (eligible.length === 0) {
            return [];
        }

        for (const quad of eligible) {
            this.store.add(quad.subject, quad.predicate, quad.object);
        }

        return this.liveStore.addQuads(eligible);
    }

    public allEquals(resource: IndexType, grade = 1.0): IndexType[] {
        if (grade >= 0) {
            return this.equivalenceSet.allValues(resource);
        }

        return [resource];
    }

    public expand(types: IndexType[]): IndexType[] {
        if (types.length === 1) {
            const existing = this.expansionCache[types[0] as unknown as string];
            this.expansionCache[types[0] as unknown as string] = existing
                ? existing
                : this.sort(this.mineForTypes(types));

            return this.expansionCache[types[0] as unknown as string];
        }

        return this.sort(this.mineForTypes(types));
    }

    public getProcessingCtx(): VocabularyProcessingContext<IndexType> {
        return {
            dataStore: this.liveStore,
            equivalenceSet: this.equivalenceSet,
            store: this,
            superMap: this.superMap,
        };
    }

    /** @ignore */
    public holdsQuad(quad: Quad): boolean {
        return this.store.holdsQuad(quad);
    }

    public isInstanceOf(resource: IndexType, superClass: IndexType): boolean {
        return this.store.holdsQuad(rdfFactory.quad(
            rdfFactory.fromId(resource) as NamedNode,
            rdf.type,
            rdfFactory.fromId(superClass) as SomeTerm,
        ));
    }

    public isSubclassOf(resource: IndexType, superClass: IndexType): boolean {
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
    public superTypeDepth(type: IndexType): number {
        const superMap = this.superMap.get(type);

        return superMap ? superMap.size : -1;
    }

    /** @ignore */
    public match(subject: SomeNode | null,
                 predicate: NamedNode | null,
                 object: SomeTerm | null,
                 graph: SomeNode | null = rdfFactory.defaultGraph(),
                 justOne: boolean = false,
    ): Quad[] {
        return this.store.match(subject, predicate, object, graph, justOne);
    }

    /**
     * Expands the given lookupTypes to include all their equivalent and subclasses.
     * This is done in multiple iterations until no new types are found.
     * @param lookupTypes The types to look up. Once given, these are assumed to be classes.
     */
    public mineForTypes(lookupTypes: IndexType[]): IndexType[] {
        if (lookupTypes.length === 0) {
            return [id(rdfs.Resource) as unknown as IndexType];
        }

        const canonicalTypes: IndexType[] = [];
        const lookupTypesExpanded = [];
        for (let i = 0; i < lookupTypes.length; i++) {
            lookupTypesExpanded.push(...this.allEquals(lookupTypes[i]));
        }
        for (let i = 0; i < lookupTypesExpanded.length; i++) {
            const canon = id(
                this.liveStore.canon(
                    rdfFactory.fromId(lookupTypes[i]) as NamedNode,
                ),
            ) as unknown as IndexType;

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

    public sort(types: IndexType[]): IndexType[] {
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
