import { Hextuple, JSLitDatatype, JSLitLang, JSLitValue, Resource } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";
import RDFIndex from "./store/RDFIndex";

import rdfFactory, { NamedNode, SomeTerm } from "./rdf";
import { RDFStore } from "./RDFStore";
import { OWL } from "./schema/owl";
import { RDFLIB } from "./schema/rdflib";
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
export class Schema {
    private static vocabularies: VocabularyProcessor[] = [OWL, RDFS, RDFLIB];

    private equivalenceSet: DisjointSet<Resource> = new DisjointSet();
    // Typescript can't handle generic index types, so it is set to string.
    private expansionCache: { [k: string]: Resource[] };
    private store: RDFIndex;
    private liveStore: RDFStore;
    private superMap: Map<Resource, Set<Resource>> = new Map();
    private processedTypes: Resource[] = [];

    public constructor(liveStore: RDFStore) {
        this.liveStore = liveStore;
        this.store = new RDFIndex();
        this.liveStore.getInternalStore().addDataCallback(this.process.bind(this));
        this.expansionCache = {};

        for (let i = 0; i < Schema.vocabularies.length; i++) {
            this.addHextuples(Schema.vocabularies[i].axioms);
        }
    }

    /**
     * Push quads onto the graph so it can be used by the render store for component determination.
     * @return The quads added to the store.
     */
    public addHextuples(quads: Hextuple[]): Hextuple[] {
        const unique = quads.filter((s) => !this.store.holdsHex(s));
        const eligible = unique.filter(this.process.bind(this));
        if (eligible.length === 0) {
            return [];
        }

        for (const quad of eligible) {
            this.store.addHex(quad);
        }

        return this.liveStore.addHextuples(eligible);
    }

    public allEquals(resource: Resource, grade = 1.0): Resource[] {
        if (grade >= 0) {
            return this.equivalenceSet.allValues(resource);
        }

        return [resource];
    }

    public expand(types: Resource[]): Resource[] {
        if (types.length === 1) {
            const existing = this.expansionCache[types[0] as unknown as string];
            this.expansionCache[types[0] as unknown as string] = existing
                ? existing
                : this.sort(this.mineForTypes(types));

            return this.expansionCache[types[0] as unknown as string];
        }

        return this.sort(this.mineForTypes(types));
    }

    public getProcessingCtx(): VocabularyProcessingContext {
        return {
            dataStore: this.liveStore,
            equivalenceSet: this.equivalenceSet,
            store: this,
            superMap: this.superMap,
        };
    }

    /** @ignore */
    public holdsHex(quad: Hextuple): boolean {
        return this.store.holdsHex(quad);
    }

    public isInstanceOf(resource: Resource, superClass: Resource): boolean {
        return this.store.holdsQuad(rdfFactory.quad(
            resource,
            rdf.type,
            rdfFactory.literal(superClass),
        ));
    }

    public isSubclassOf(resource: Resource, superClass: Resource): boolean {
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
    public superTypeDepth(type: Resource): number {
        const superMap = this.superMap.get(type);

        return superMap ? superMap.size : -1;
    }

    /** @ignore */
    public match(subject: SomeNode | null,
                 predicate: NamedNode | null,
                 object: SomeTerm | null,
                 graph: SomeNode | null,
                 justOne: boolean = false,
    ): Hextuple[] {
        return this.store.match(subject, predicate, object, graph, justOne);
    }

    /** @ignore */
    public matchHex(
        subject: Resource | null,
        predicate: NamedNode | null,
        object: JSLitValue | null,
        objectDt: JSLitDatatype | null,
        objectL: JSLitLang | null,
        graph: SomeNode | null,
        justOne: boolean = false,
    ): Hextuple[] {
        return this.store.matchHex(subject, predicate, object, objectDt, objectL, graph, justOne);
    }

    /**
     * Expands the given lookupTypes to include all their equivalent and subclasses.
     * This is done in multiple iterations until no new types are found.
     * @param lookupTypes The types to look up. Once given, these are assumed to be classes.
     */
    public mineForTypes(lookupTypes: Resource[]): Resource[] {
        if (lookupTypes.length === 0) {
            return [rdfs.Resource];
        }

        const canonicalTypes: Resource[] = [];
        const lookupTypesExpanded = lookupTypes
            .reduce<Resource[]>((acc, t) => acc.concat(...this.allEquals(t)), []);
        for (let i = 0; i < lookupTypesExpanded.length; i++) {
            const canon = this.liveStore.canon(lookupTypes[i]);

            if (!this.processedTypes.includes(canon)) {
                for (let j = 0; j < Schema.vocabularies.length; j++) {
                    Schema.vocabularies[j].processType(
                        canon,
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

    public sort(types: Resource[]): Resource[] {
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

    private process(item: Hextuple): Hextuple[] | null {
        for (let i = 0; i < Schema.vocabularies.length; i++) {
            const res = Schema.vocabularies[i].processStatement(item, this.getProcessingCtx());
            if (res !== null) {
                return res;
            }
        }

        return null;
    }
}
