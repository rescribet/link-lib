import { DataFactory } from "@ontologies/core";
import rdf from "@ontologies/rdf";
import {
    graph,
    Store,
} from "./rdflib";

import rdfFactory, {
    NamedNode,
    Node,
    OptionalNode,
    Quad,
    Quadruple,
    Term,
} from "./rdf";
import { deltaProcessor } from "./store/deltaProcessor";
import { ChangeBuffer, DeltaProcessor, SomeNode, StoreProcessor } from "./types";
import { allRDFPropertyStatements, getPropBestLang } from "./utilities";
import { defaultNS as NS } from "./utilities/constants";
import { patchRDFLibStoreWithOverrides } from "./utilities/monkeys";

const EMPTY_ST_ARR: ReadonlyArray<Quad> = Object.freeze([]);

export interface RDFStoreOpts {
    deltaProcessorOpts?: {[k: string]: Array<NamedNode | undefined>};
    innerStore?: Store;
}

/**
 * Provides a clean consistent interface to stored (RDF) data.
 */
export class RDFStore implements ChangeBuffer, DeltaProcessor {
    public changeBuffer: Quad[] = new Array(100);
    public changeBufferCount: number = 0;
    /**
     * Record of the last time a resource was flushed.
     *
     * @note Not to be confused with the last change in the store, which might be later than the flush time.
     */
    public changeTimestamps: number[] = [];
    public typeCache: NamedNode[][] = [];

    private deltas: Quadruple[][] = [];
    private deltaProcessor: StoreProcessor;
    private langPrefs: string[] = Array.from(typeof navigator !== "undefined"
        ? (navigator.languages || [navigator.language])
        : ["en"]);
    private store: Store = graph();

    public get rdfFactory(): DataFactory {
        return this.store.rdfFactory;
    }
    public set rdfFactory(value: DataFactory) {
        throw this.store.rdfFactory = value;
    }

    constructor({ deltaProcessorOpts, innerStore }: RDFStoreOpts = {}) {
        this.processDelta = this.processDelta.bind(this);

        const g = innerStore || graph();
        this.store = patchRDFLibStoreWithOverrides(g, this);
        this.store.newPropertyAction(rdf.type, this.processTypeStatement.bind(this));

        const defaults =  {
            addGraphIRIS: [NS.ll("add"), NS.ld("add")],
            purgeGraphIRIS: [NS.ll("purge"), NS.ld("purge")],
            removeGraphIRIS: [NS.ll("remove"), NS.ld("remove")],
            replaceGraphIRIS: [
                undefined,
                NS.ll("replace"),
                NS.ld("replace"),
                this.store.rdfFactory.defaultGraph(),
            ],
            sliceGraphIRIS: [NS.ll("slice"), NS.ld("slice")],
        };

        this.deltaProcessor = deltaProcessor(
            deltaProcessorOpts?.addGraphIRIS || defaults.addGraphIRIS,
            deltaProcessorOpts?.replaceGraphIRIS || defaults.replaceGraphIRIS,
            deltaProcessorOpts?.removeGraphIRIS || defaults.removeGraphIRIS,
            deltaProcessorOpts?.purgeGraphIRIS || defaults.purgeGraphIRIS,
            deltaProcessorOpts?.sliceGraphIRIS || defaults.sliceGraphIRIS,
        )(this.store);
    }

    /**
     * Add statements to the store.
     * @param data Data to parse and add to the store.
     */
    public addStatements(data: Quad[]): void {
        if (!Array.isArray(data)) {
            throw new TypeError("An array of statements must be passed to addStatements");
        }

        for (let i = 0, len = data.length; i < len; i++) {
            this.store.add(data[i].subject, data[i].predicate, data[i].object, data[i].graph);
        }
    }

    public addQuads(data: Quadruple[]): Quad[] {
        const statements = new Array(data.length);
        for (let i = 0, len = data.length; i < len; i++) {
            statements[i] = this.store.add(data[i][0], data[i][1], data[i][2], data[i][3]);
        }

        return statements;
    }

    public any(
        subj: OptionalNode,
        pred?: OptionalNode,
        obj?: OptionalNode,
        why?: OptionalNode,
    ): Term | undefined {
        return this.store.any(subj, pred, obj, why);
    }

    public anyStatementMatching(subj: OptionalNode,
                                pred?: OptionalNode,
                                obj?: OptionalNode,
                                why?: OptionalNode): Quad | undefined {
        return this.store.anyStatementMatching(subj, pred, obj, why);
    }

    public anyValue(subj: OptionalNode,
                    pred?: OptionalNode,
                    obj?: OptionalNode,
                    why?: OptionalNode): string | undefined {
        return this.store.anyValue(subj, pred, obj, why);
    }

    public canon(term: SomeNode): SomeNode {
        return this.store.canon(term);
    }

    public defaultGraph(): SomeNode {
        return this.store.rdfFactory.defaultGraph();
    }

    /**
     * Flushes the change buffer to the return value.
     * @return Statements held in memory since the last flush.
     */
    public flush(): Quad[] {
        const deltas = this.deltas;
        this.deltas = [];

        for (let i = 0; i < deltas.length; i++) {
            this.processDelta(deltas[i]);
        }

        if (this.changeBufferCount === 0) {
            return EMPTY_ST_ARR as Quad[];
        }
        const processingBuffer = this.changeBuffer;
        this.changeBuffer = new Array(100);
        this.changeBufferCount = 0;
        const changeStamp = Date.now();
        processingBuffer
            .filter((s) => {
                this.changeTimestamps[rdfFactory.id(s.subject)] = changeStamp;
                return rdfFactory.equals(s.predicate, rdf.type);
            })
            .map((s) => this.processTypeStatement(undefined, s.subject, s.predicate, undefined, undefined));

        return processingBuffer;
    }

    /** @private */
    public getInternalStore(): Store {
        return this.store;
    }

    public match(subj: OptionalNode,
                 pred?: OptionalNode,
                 obj?: OptionalNode,
                 why?: OptionalNode): Quad[] {
        return this.store.match(subj, pred, obj, why) || [];
    }

    public processDelta(delta: Quadruple[]): Quad[] {
        const [
            addables,
            replacables,
            removables,
        ] = this.deltaProcessor(delta);

        this.removeStatements(removables);

        return this.replaceMatches(replacables).concat(this.addQuads(addables));
    }

    public removeResource(subject: SomeNode): void {
        this.touch(subject);
        this.typeCache[rdfFactory.id(subject)] = [];
        this.removeStatements(this.statementsFor(subject));
    }

    public removeStatements(statements: Quad[]): void {
        this.store.remove(statements.slice());
    }

    /**
     * Removes an array of statements and inserts another.
     * Note: Be sure that the replacement contains the same subjects as the original to let the
     *  broadcast work correctly.
     * @access private This is in conflict with the typescript declaration due to the development of some experimental
     *                  features, but this method shouldn't be used nevertheless.
     * @param original The statements to remove from the store.
     * @param replacement The statements to add to the store.
     */
    public replaceStatements(original: Quad[], replacement: Quad[]): void {
        const uniqueStatements = new Array(replacement.length).filter(Boolean);
        for (let i = 0; i < replacement.length; i++) {
            const cond = original.some(
                ({ subject, predicate }) => rdfFactory.equals(subject, replacement[i].subject)
                    && rdfFactory.equals(predicate, replacement[i].predicate),
            );
            if (!cond) {
                uniqueStatements.push(replacement[i]);
            }
        }

        this.removeStatements(original);
        // Remove statements not in the old object. Useful for replacing data loosely related to the main resource.
        for (let i = 0; i < uniqueStatements.length; i++) {
            this.store.removeMatches(uniqueStatements[i].subject, uniqueStatements[i].predicate);
        }

        return this.addStatements(replacement);
    }

    public replaceMatches(statements: Quadruple[]): Quad[] {
        for (let i = 0; i < statements.length; i++) {
            this.removeStatements(this.match(
                statements[i][0],
                statements[i][1],
                undefined,
                undefined,
            ));
        }

        return this.addQuads(statements);
    }

    public getResourcePropertyRaw(subject: SomeNode, property: SomeNode | SomeNode[]): Quad[] {
        const props = this.statementsFor(subject);
        if (Array.isArray(property)) {
            for (let i = 0; i < property.length; i++) {
                const values = allRDFPropertyStatements(props, property[i]);
                if (values.length > 0) {
                    return values;
                }
            }

            return EMPTY_ST_ARR as Quad[];
        }

        return allRDFPropertyStatements(props, property);
    }

    public getResourceProperties<TT extends Term = Term>(subject: SomeNode, property: SomeNode | SomeNode[]): TT[] {
        if (property === rdf.type) {
            return (this.typeCache[rdfFactory.id(subject)] || []) as TT[];
        }

        return this
            .getResourcePropertyRaw(subject, property)
            .map((s) => s.object as TT);
    }

    public getResourceProperty<T extends Term = Term>(
        subject: SomeNode,
        property: SomeNode | SomeNode[],
    ): T | undefined {

        if (!Array.isArray(property) && rdfFactory.equals(property, rdf.type)) {
            const entry = this.typeCache[rdfFactory.id(subject)];

            return entry ? entry[0] as T : undefined;
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
     * Searches the store for all the statements on {iri} (so not all statements relating to {iri}).
     * @param subject The identifier of the resource.
     */
    public statementsFor(subject: SomeNode): Quad[] {
        const canon = rdfFactory.id(this.store.canon(subject));

        return typeof this.store.subjectIndex[canon] !== "undefined"
            ? this.store.subjectIndex[canon]
            : EMPTY_ST_ARR as Quad[];
    }

    public touch(iri: SomeNode): void {
        this.changeTimestamps[rdfFactory.id(iri)] = Date.now();
        this.changeBuffer.push(rdfFactory.quad(iri, NS.ll("nop"), NS.ll("nop")));
        this.changeBufferCount++;
    }

    public workAvailable(): number {
        return this.deltas.length + this.changeBufferCount;
    }

    /**
     * Builds a cache of types per resource. Can be omitted when compiled against a well known service.
     */
    private processTypeStatement(_formula: Store | undefined,
                                 subj: SomeNode,
                                 _pred: NamedNode,
                                 obj?: Term,
                                 _why?: Node): boolean {
        const subjId = rdfFactory.id(subj);
        if (!Array.isArray(this.typeCache[subjId])) {
            this.typeCache[subjId] = [obj as NamedNode];
            return false;
        }
        this.typeCache[subjId] = this.statementsFor((subj as NamedNode))
            .filter((s) => rdfFactory.equals(s.predicate, rdf.type))
            .map((s) => s.object as NamedNode);
        if (obj) {
            this.typeCache[subjId].push((obj as NamedNode));
        }
        return false;
    }
}
