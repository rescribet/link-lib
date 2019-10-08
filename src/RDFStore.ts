import rdf from "@ontologies/rdf";
import {
    Formula,
    graph,
    IndexedFormula,
} from "rdflib";

import rdfFactory, {
    NamedNode,
    Node,
    OptionalNode,
    Quad,
    Quadruple,
    RDFObjectBase,
    Term,
} from "./rdf";
import { deltaProcessor } from "./store/deltaProcessor";
import { ChangeBuffer, DeltaProcessor, SomeNode, StoreProcessor } from "./types";
import { allRDFPropertyStatements, getPropBestLang } from "./utilities";
import { defaultNS as NS } from "./utilities/constants";
import { patchRDFLibStoreWithOverrides } from "./utilities/monkeys";

const EMPTY_ST_ARR: ReadonlyArray<Quad<any>> = Object.freeze([]);

export interface RDFStoreOpts {
    deltaProcessorOpts: {[k: string]: Array<NamedNode | undefined>};
}

/**
 * Provides a clean consistent interface to stored (RDF) data.
 */
export class RDFStore<RDFBase extends RDFObjectBase> implements ChangeBuffer, DeltaProcessor<RDFBase> {
    public changeBuffer: Array<Quad<RDFBase>> = new Array(100);
    public changeBufferCount: number = 0;
    /**
     * Record of the last time a resource was flushed.
     *
     * @note Not to be confused with the last change in the store, which might be later than the flush time.
     */
    public changeTimestamps: Uint32Array = new Uint32Array(0x100000);
    public typeCache: Array<Array<NamedNode<RDFBase>>> = [];

    private deltas: Array<Array<Quadruple<RDFBase>>> = [];
    private deltaProcessor: StoreProcessor<RDFBase>;
    private langPrefs: string[] = Array.from(typeof navigator !== "undefined"
        ? (navigator.languages || [navigator.language])
        : ["en"]);
    private store: IndexedFormula<RDFBase> = graph();

    constructor({ deltaProcessorOpts }: RDFStoreOpts = { deltaProcessorOpts: {} }) {
        this.processDelta = this.processDelta.bind(this);

        const g = graph<RDFBase>();
        this.store = patchRDFLibStoreWithOverrides<RDFBase>(g, this);
        this.store.newPropertyAction(rdf.type, this.processTypeStatement.bind(this));

        const defaults =  {
            addGraphIRIS: [NS.ll("add")],
            purgeGraphIRIS: [NS.ll("purge")],
            removeGraphIRIS: [NS.ll("remove")],
            replaceGraphIRIS: [
                undefined,
                NS.ll("replace"),
                this.store.defaultGraphIRI,
            ],
            sliceGraphIRIS: [NS.ll("slice")],
        };

        this.deltaProcessor = deltaProcessor(
            deltaProcessorOpts.addGraphIRIS || defaults.addGraphIRIS,
            deltaProcessorOpts.replaceGraphIRIS || defaults.replaceGraphIRIS,
            deltaProcessorOpts.removeGraphIRIS || defaults.removeGraphIRIS,
            deltaProcessorOpts.purgeGraphIRIS || defaults.purgeGraphIRIS,
            deltaProcessorOpts.sliceGraphIRIS || defaults.sliceGraphIRIS,
        )(this.store);
    }

    /**
     * Add statements to the store.
     * @param data Data to parse and add to the store.
     */
    public addStatements(data: Array<Quad<RDFBase>>): void {
        if (!Array.isArray(data)) {
            throw new TypeError("An array of statements must be passed to addStatements");
        }

        for (let i = 0, len = data.length; i < len; i++) {
            this.store.addStatement(data[i]);
        }
    }

    public addQuads(data: Array<Quadruple<RDFBase>>): Array<Quad<RDFBase>> {
        const statements = new Array(data.length);
        for (let i = 0, len = data.length; i < len; i++) {
            statements[i] = this.store.add(data[i][0], data[i][1], data[i][2], data[i][3]);
        }

        return statements;
    }

    public any(
        subj: OptionalNode<RDFBase>,
        pred?: OptionalNode<RDFBase>,
        obj?: OptionalNode<RDFBase>,
        why?: OptionalNode<RDFBase>,
    ): Term<RDFBase> | undefined {
        return this.store.any(subj, pred, obj, why);
    }

    public anyStatementMatching(subj: OptionalNode<RDFBase>,
                                pred?: OptionalNode<RDFBase>,
                                obj?: OptionalNode<RDFBase>,
                                why?: OptionalNode<RDFBase>): Quad<RDFBase> | undefined {
        return this.store.anyStatementMatching(subj, pred, obj, why);
    }

    public anyValue(subj: OptionalNode<RDFBase>,
                    pred?: OptionalNode<RDFBase>,
                    obj?: OptionalNode<RDFBase>,
                    why?: OptionalNode<RDFBase>): string | undefined {
        return this.store.anyValue(subj, pred, obj, why);
    }

    public canon(term: Node<RDFBase>): Node<RDFBase> {
        return this.store.canon(term);
    }

    /**
     * Flushes the change buffer to the return value.
     * @return Statements held in memory since the last flush.
     */
    public flush(): Array<Quad<RDFBase>> {
        const deltas = this.deltas;
        this.deltas = [];

        for (let i = 0; i < deltas.length; i++) {
            this.processDelta(deltas[i]);
        }

        if (this.changeBufferCount === 0) {
            return EMPTY_ST_ARR as Array<Quad<RDFBase>>;
        }
        const processingBuffer = this.changeBuffer;
        this.changeBuffer = new Array(100);
        this.changeBufferCount = 0;
        const changeStamp = Date.now();
        processingBuffer
            .filter((s) => {
                this.changeTimestamps[s.subject.id] = changeStamp;
                return s.predicate === rdf.type;
            })
            .map((s) => this.processTypeStatement(undefined, s.subject, s.predicate, undefined, undefined));

        return processingBuffer;
    }

    /** @private */
    public getInternalStore(): IndexedFormula<RDFBase> {
        return this.store;
    }

    public match(subj: OptionalNode<RDFBase>,
                 pred?: OptionalNode<RDFBase>,
                 obj?: OptionalNode<RDFBase>,
                 why?: OptionalNode<RDFBase>): Array<Quad<RDFBase>> {
        return this.store.match(subj, pred, obj, why) || [];
    }

    public processDelta(delta: Array<Quadruple<RDFBase>>): Array<Quad<RDFBase>> {
        const [
            addables,
            replacables,
            removables,
        ] = this.deltaProcessor(delta);

        this.removeStatements(removables);

        return this.replaceMatches(replacables).concat(this.addQuads(addables));
    }

    public removeResource(subject: SomeNode<RDFBase>): void {
        this.touch(subject);
        this.typeCache[subject.id] = [];
        this.removeStatements(this.statementsFor(subject));
    }

    public removeStatements(statements: Array<Quad<RDFBase>>): void {
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
    public replaceStatements(original: Array<Quad<RDFBase>>, replacement: Array<Quad<RDFBase>>): void {
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

    public replaceMatches(statements: Array<Quadruple<RDFBase>>): Array<Quad<RDFBase>> {
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

    public getResourcePropertyRaw(subject: SomeNode<RDFBase>,
                                  property: SomeNode<RDFBase> | Array<SomeNode<RDFBase>>): Array<Quad<RDFBase>> {

        const props = this.statementsFor(subject);
        if (Array.isArray(property)) {
            for (let i = 0; i < property.length; i++) {
                const values = allRDFPropertyStatements(props, property[i]);
                if (values.length > 0) {
                    return values;
                }
            }

            return EMPTY_ST_ARR as Array<Quad<RDFBase>>;
        }

        return allRDFPropertyStatements(props, property);
    }

    public getResourceProperties(subject: SomeNode<RDFBase>,
                                 property: SomeNode<RDFBase> | Array<SomeNode<RDFBase>>): Array<Term<RDFBase>> {

        if (property === rdf.type) {
            return this.typeCache[subject.id] || [];
        }

        return this
            .getResourcePropertyRaw(subject, property)
            .map((s) => s.object);
    }

    public getResourceProperty(subject: SomeNode<RDFBase>,
                               property: SomeNode<RDFBase> | Array<SomeNode<RDFBase>>): Term | undefined {
        if (property === rdf.type) {
            const entry = this.typeCache[subject.id];
            return entry ? entry[0] : undefined;
        }
        const rawProp = this.getResourcePropertyRaw(subject, property);
        if (rawProp.length === 0) {
            return undefined;
        }

        return getPropBestLang(rawProp, this.langPrefs);
    }

    public queueDelta(delta: Array<Quadruple<RDFBase>>): void {
        this.deltas.push(delta);
    }

    /**
     * Searches the store for all the statements on {iri} (so not all statements relating to {iri}).
     * @param subject The identifier of the resource.
     */
    public statementsFor(subject: SomeNode<RDFBase>): Array<Quad<RDFBase>> {
        const canon = (this.store.canon(subject) as Term).id;

        return typeof this.store.subjectIndex[canon] !== "undefined"
            ? this.store.subjectIndex[canon]
            : EMPTY_ST_ARR as Array<Quad<RDFBase>>;
    }

    public touch(iri: SomeNode<RDFBase>): void {
        this.changeTimestamps[iri.id] = Date.now();
        this.changeBuffer.push(rdfFactory.quad(iri, NS.ll("nop"), NS.ll("nop")) as Quad<RDFBase>);
        this.changeBufferCount++;
    }

    public workAvailable(): number {
        return this.deltas.length + this.changeBufferCount;
    }

    /**
     * Builds a cache of types per resource. Can be omitted when compiled against a well known service.
     */
    private processTypeStatement(_formula: Formula<RDFBase> | undefined,
                                 subj: SomeNode<RDFBase>,
                                 _pred: NamedNode<RDFBase>,
                                 obj?: Term<RDFBase>,
                                 _why?: Node<RDFBase>): boolean {
        if (!Array.isArray(this.typeCache[subj.id])) {
            this.typeCache[subj.id] = [obj as NamedNode<RDFBase>];
            return false;
        }
        this.typeCache[subj.id] = this.statementsFor((subj as NamedNode<RDFBase>))
            .filter((s) => s.predicate === rdf.type)
            .map((s) => s.object as NamedNode<RDFBase>);
        if (obj) {
            this.typeCache[subj.id].push((obj as NamedNode<RDFBase>));
        }
        return false;
    }
}
