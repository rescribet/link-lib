import rdfFactory, {
    DataFactory,
    NamedNode,
    QuadPosition,
    Quadruple,
    SomeTerm,
    Term,
} from "@ontologies/core";
import * as ld from "@ontologies/ld";
import * as rdf from "@ontologies/rdf";

import { equals } from "./factoryHelpers";
import ll from "./ontology/ll";
import {
    OptionalNamedNode,
    OptionalNode,
    OptionalTerm,
} from "./rdf";
import { deltaProcessor } from "./store/deltaProcessor";
import { RDFAdapter } from "./store/RDFAdapter";
import RDFIndex from "./store/RDFIndex";
import { DataRecord, Id } from "./store/types";
import { DeltaProcessor, SomeNode, StoreProcessor } from "./types";
import { getPropBestLang, normalizeType, sortByBestLang } from "./utilities";

const EMPTY_ST_ARR: ReadonlyArray<Quadruple> = Object.freeze([]);

export interface RDFStoreOpts {
    data?: Record<Id, DataRecord>;
    deltaProcessorOpts?: { [k: string]: NamedNode[] };
    innerStore?: RDFIndex;
}

/**
 * Provides a clean consistent interface to stored (RDF) data.
 */
export class RDFStore implements DeltaProcessor {
    public langPrefs: string[] = Array.from(typeof navigator !== "undefined"
        ? (navigator.languages || [navigator.language])
        : ["en"]);
    private changedResources: Set<string> = new Set();

    private deltas: Quadruple[][] = [];
    private deltaProcessor: StoreProcessor;

    private store: RDFIndex = new RDFIndex({
        onChange: this.handleChange.bind(this),
    });

    public get rdfFactory(): DataFactory {
        return rdfFactory;
    }
    public set rdfFactory(_: DataFactory) {
        throw new Error("Factory is global (see @ontologies/core)");
    }

    private defaultGraph: NamedNode = this.rdfFactory.defaultGraph();

    constructor({ data, deltaProcessorOpts, innerStore }: RDFStoreOpts = {}) {
        this.processDelta = this.processDelta.bind(this);

        this.store = innerStore || new RDFIndex({ data, onChange: this.handleChange.bind(this) });

        const defaults =  {
            addGraphIRIS: [ll.add, ld.add],
            purgeGraphIRIS: [ll.purge, ld.purge],
            removeGraphIRIS: [ll.remove, ld.remove],
            replaceGraphIRIS: [
                ll.replace,
                ld.replace,
                rdfFactory.defaultGraph(),
            ],
            sliceGraphIRIS: [ll.slice, ld.slice],
        };

        this.deltaProcessor = deltaProcessor(
            deltaProcessorOpts?.addGraphIRIS || defaults.addGraphIRIS,
            deltaProcessorOpts?.replaceGraphIRIS || defaults.replaceGraphIRIS,
            deltaProcessorOpts?.removeGraphIRIS || defaults.removeGraphIRIS,
            deltaProcessorOpts?.purgeGraphIRIS || defaults.purgeGraphIRIS,
            deltaProcessorOpts?.sliceGraphIRIS || defaults.sliceGraphIRIS,
        )(this.store);
    }

    /** @deprecated */
    public add(subject: SomeNode, predicate: NamedNode, object: SomeTerm): Quadruple {
        return this.store.add(
            subject,
            predicate,
            object,
        );
    }

    /**
     * Add statements to the store.
     * @param data Data to parse and add to the store.
     * @deprecated
     */
    public addQuads(data: Quadruple[]): Quadruple[] {
        if (!Array.isArray(data)) {
            throw new TypeError("An array of quads must be passed to addQuads");
        }

        return data.map((q) => this.store.add(
            q[QuadPosition.subject],
            q[QuadPosition.predicate],
            q[QuadPosition.object],
            q[QuadPosition.graph],
        ));
    }

    /** @deprecated */
    public addQuadruples(data: Quadruple[]): Quadruple[] {
        const statements = new Array(data.length);
        for (let i = 0, len = data.length; i < len; i++) {
            statements[i] = this.store.add(data[i][0], data[i][1], data[i][2], data[i][3]);
        }

        return statements;
    }

    /** @deprecated */
    public primary(term: SomeNode): SomeNode {
        return this.store.primary(term);
    }

    /**
     * Flushes the change buffer to the return value.
     * @return Statements held in memory since the last flush.
     */
    public flush(): Set<string> {
        const deltas = this.deltas;
        this.deltas = [];

        for (let i = 0; i < deltas.length; i++) {
            this.processDelta(deltas[i]);
        }

        const changes = this.changedResources;
        this.changedResources = new Set();

        return changes;
    }

    /** @private */
    public getInternalStore(): RDFIndex {
        return this.store;
    }

    public references(recordId: SomeNode): Id[] {
        return this.store.references(recordId);
    }

    /** @deprecated */
    public match(
        subj: OptionalNode,
        pred: OptionalNamedNode,
        obj: OptionalTerm,
        justOne: boolean = false,
    ): Quadruple[] {
        return this.store.match(subj, pred, obj, justOne) ?? EMPTY_ST_ARR;
    }

    public processDelta(delta: Quadruple[]): Quadruple[] {
        const [
            addables,
            replacables,
            removables,
        ] = this.deltaProcessor(delta);

        this.removeQuads(removables);

        return this.replaceMatches(replacables).concat(this.addQuadruples(addables));
    }

    public removeResource(subject: SomeNode): void {
        const canSubj = this.primary(subject);
        this.touch(canSubj);
        (this.store as RDFAdapter).deleteRecord(subject);
    }

    /** @deprecated */
    public removeQuads(statements: Quadruple[]): void {
        this.store.removeQuads(statements);
    }

    /** @deprecated */
    public replaceMatches(statements: Quadruple[]): Quadruple[] {
        for (let i = 0; i < statements.length; i++) {
            this.removeQuads(this.match(
                statements[i][0],
                statements[i][1],
                null,
            ));
        }

        return this.addQuadruples(statements);
    }

    public getResourcePropertyRaw(subject: SomeNode, property: SomeNode | SomeNode[]): Quadruple[] {
        const properties = normalizeType(property);
        const matched = [];
        for (const prop of properties) {
            const quads = normalizeType(this.store.store.getField(subject.value, prop.value))
              .filter((v) => v !== undefined)
              .map<Quadruple>((v) => [subject, prop as NamedNode, v!, this.defaultGraph]);
            matched.push(...quads);
        }

        if (matched.length === 0) {
            return EMPTY_ST_ARR as Quadruple[];
        }

        return sortByBestLang(matched, this.langPrefs);
    }

    public getResourceProperties<TT extends Term = Term>(subject: SomeNode, property: SomeNode | SomeNode[]): TT[] {
        if (property === rdf.type) {
            const value = this.store.store.getField(subject.value, rdf.type.value);

            if (!value) {
                return EMPTY_ST_ARR as unknown as TT[];
            } else {
                return normalizeType(value) as TT[];
            }
        }

        const properties = normalizeType(property);
        const matched = [];
        for (const prop of properties) {
            const quads = normalizeType(this.store.store.getField(subject.value, prop.value))
              .filter((v) => v !== undefined);
            matched.push(...quads);
        }

        if (matched.length === 0) {
            return EMPTY_ST_ARR as unknown as TT[];
        }

        return matched as TT[];
    }

    public getResourceProperty<T extends Term = Term>(
        subject: SomeNode,
        property: SomeNode | SomeNode[],
    ): T | undefined {

        if (!Array.isArray(property) && equals(property, rdf.type)) {
            return this.store.store.getField(subject.value, rdf.type.value) as T;
        }
        const rawProp = this.getResourcePropertyRaw(subject, property);
        if (rawProp.length === 0) {
            return undefined;
        }

        return getPropBestLang<T>(rawProp, this.langPrefs);
    }

    public queueDelta(delta: Quadruple[]): void {
        this.deltas.push(delta);
    }

    /**
     * Searches the store for all the quads on {iri} (so not all statements relating to {iri}).
     * @param subject The identifier of the resource.
     */
    public quadsFor(subject: SomeNode): Quadruple[] {
        return this.store.quadsForRecord(subject.value);
    }

    public touch(iri: SomeNode): void {
        this.store.store.touch(iri.value);
    }

    public workAvailable(): number {
        return this.deltas.length + this.changedResources.size;
    }

    private handleChange(docId: string): void {
        this.changedResources.add(docId);
    }
}
