import { NamedNode, QuadPosition, Quadruple, SomeTerm } from "@ontologies/core";
import * as rdfx from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";

import { OWL } from "./schema/owl";
import { RDFS } from "./schema/rdfs";
import { DisjointSet } from "./utilities/DisjointSet";

import { RDFStore } from "./RDFStore";
import { Id } from "./store/StructuredStore";
import {
    SomeNode,
    VocabularyProcessingContext,
    VocabularyProcessor,
} from "./types";

/**
 * Implements some RDF/OWL logic to enhance the functionality of the property lookups.
 *
 * Basically duplicates some functionality already present in {IndexedFormula} IIRC, but this API should be more
 * optimized so it can be used in real-time by low-power devices as well.
 */
export class Schema {
    private static vocabularies: VocabularyProcessor[] = [OWL, RDFS];

    private equivalenceSet: DisjointSet<string> = new DisjointSet();
    // Typescript can't handle generic index types, so it is set to string.
    private expansionCache: { [k: string]: string[] };
    private liveStore: RDFStore;
    private superMap: Map<string, Set<string>> = new Map();
    private processedTypes: string[] = [];

    public constructor(liveStore: RDFStore) {
        this.liveStore = liveStore;
        this.liveStore.getInternalStore().addDataCallback(this.process.bind(this));
        this.expansionCache = {};

        for (let i = 0; i < Schema.vocabularies.length; i++) {
            this.liveStore.addQuadruples(Schema.vocabularies[i].axioms);
        }

        const preexisting = liveStore.getInternalStore().quads;
        for (const quad of preexisting) {
            this.process(quad);
        }
    }

    public allEquals(recordId: Id, grade = 1.0): Id[] {
        if (grade >= 0) {
            return this.equivalenceSet.allValues(recordId);
        }

        return [recordId];
    }

    /** @private */
    public holds(recordId: SomeNode, field: NamedNode, value: SomeTerm): boolean {
        return !!this.liveStore.getInternalStore().match(
            recordId,
            field,
            value,
            true,
        )[0];
    }

    /** @private */
    public isInstanceOf(recordId: Id, klass: Id): boolean {
        const type = this.liveStore.getInternalStore().store.getField(recordId, rdfx.type.value);

        if (type === undefined) {
            return false;
        }

        const allCheckTypes = this.expand([klass]);
        const allRecordTypes = this.expand(Array.isArray(type) ? type.map((t) => t.value) : [type.value]);

        return allRecordTypes.some((t) => allCheckTypes.includes(t));
    }

    public expand(types: Id[]): Id[] {
        if (types.length === 1) {
            const existing = this.expansionCache[types[0] as unknown as string];
            this.expansionCache[types[0] as unknown as string] = existing
                ? existing
                : this.sort(this.mineForTypes(types));

            return this.expansionCache[types[0] as unknown as string];
        }

        return this.sort(this.mineForTypes(types));
    }

    public getProcessingCtx(): VocabularyProcessingContext<string> {
        return {
            dataStore: this.liveStore,
            equivalenceSet: this.equivalenceSet,
            store: this,
            superMap: this.superMap,
        };
    }

    /**
     * Expands the given lookupTypes to include all their equivalent and subclasses.
     * This is done in multiple iterations until no new types are found.
     * @param lookupTypes The types to look up. Once given, these are assumed to be classes.
     */
    public mineForTypes(lookupTypes: string[]): string[] {
        if (lookupTypes.length === 0) {
            return [rdfs.Resource.value];
        }

        const canonicalTypes: string[] = [];
        const lookupTypesExpanded = [];
        for (let i = 0; i < lookupTypes.length; i++) {
            lookupTypesExpanded.push(...this.allEquals(lookupTypes[i]));
        }
        for (let i = 0; i < lookupTypesExpanded.length; i++) {
            const canon = this.liveStore.getInternalStore().store.primary(lookupTypes[i]);

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

    public sort(types: string[]): string[] {
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

    /**
     * Returns the hierarchical depth of the type, or -1 if unknown.
     * @param type the type to check
     */
    private superTypeDepth(type: string): number {
        const superMap = this.superMap.get(type);

        return superMap ? superMap.size : -1;
    }

    private isSubclassOf(resource: string, superClass: string): boolean {
        const resourceMap = this.superMap.get(resource);

        if (resourceMap) {
            return resourceMap.has(superClass);
        }
        return false;
    }

    private process(item: Quadruple): void {
        for (let i = 0; i < Schema.vocabularies.length; i++) {
            Schema.vocabularies[i].processStatement(
                item[QuadPosition.subject].value,
                item[QuadPosition.predicate].value,
                item[QuadPosition.object],
                this.getProcessingCtx(),
            );
        }
    }
}
