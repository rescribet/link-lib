import { DataFactory, Feature, QuadPosition } from "@ontologies/core";
import ld from "@ontologies/ld";
import rdf from "@ontologies/rdf";
import rdfs from "@ontologies/rdfs";

import { equals, id } from "./factoryHelpers";
import ll from "./ontology/ll";
import rdfFactory, {
    NamedNode,
    OptionalNamedNode,
    OptionalNode,
    OptionalTerm,
    Quad,
    Quadruple,
    Term,
} from "./rdf";
import { deltaProcessor } from "./store/deltaProcessor";
import RDFIndex from "./store/RDFIndex";
import { ChangeBuffer, DeltaProcessor, SomeNode, StoreProcessor } from "./types";
import { doc, getPropBestLang } from "./utilities";
import { patchRDFLibStoreWithOverrides } from "./utilities/monkeys";

const EMPTY_ST_ARR: ReadonlyArray<Quad> = Object.freeze([]);

export interface RDFStoreOpts {
    deltaProcessorOpts?: { [k: string]: NamedNode[] };
    innerStore?: RDFIndex;
}

export interface Funlets {
    allRDFPropertyStatements: (obj: Quad[] | undefined, predicate: SomeNode) => Quad[];
    flushFilter: (changeStamp: number) => (s: Quad) => boolean;
    /** Builds a cache of types per resource. Can be omitted when compiled against a well known service. */
    processTypeQuad: (quad: Quad) => boolean;
    replaceQuadsPicker: (replacement: Quad) => ({ subject, predicate }: Quad) => boolean;
}
const memberPrefix = rdf.ns("_").value;

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
    private store: RDFIndex = new RDFIndex();
    private funlets: Funlets;

    public get rdfFactory(): DataFactory {
        return rdfFactory;
    }
    public set rdfFactory(_: DataFactory) {
        throw new Error("Factory is global (see @ontologies/core)");
    }

    constructor({ deltaProcessorOpts, innerStore }: RDFStoreOpts = {}) {
        this.processDelta = this.processDelta.bind(this);

        const g = innerStore || new RDFIndex();
        this.store = patchRDFLibStoreWithOverrides(g, this);

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

        const defaultFunlets: Funlets = Object.freeze({
            allRDFPropertyStatements: (obj: Quad[] | undefined, predicate: SomeNode): Quad[] => {
                if (typeof obj === "undefined") {
                    return [];
                }

                if (equals(predicate, rdfs.member)) {
                    return obj.filter((s) =>
                        equals(s.predicate, rdfs.member) || s.predicate.value.startsWith(memberPrefix));
                }

                const t = [];
                for (let i = 0; i < obj.length; i++) {
                    if (equals(predicate, obj[i].predicate)) {
                        t.push(obj[i]);
                    }
                }
                return t;
            },
            flushFilter: (changeStamp: number): any => (s: Quad): boolean => {
                this.changeTimestamps[id(s.subject)] = changeStamp;
                this.changeTimestamps[id(doc(s.subject))] = changeStamp;
                return equals(s.predicate, rdf.type);
            },
            processTypeQuad: (quad: Quad): boolean => {
                if (!equals(quad.predicate, rdf.type)) {
                    return false;
                }
                const subjId = id(quad.subject);
                if (!Array.isArray(this.typeCache[subjId])) {
                    this.typeCache[subjId] = [];
                }
                this.typeCache[subjId] = this.quadsFor((quad.subject as NamedNode))
                    .filter((s) => equals(s.predicate, rdf.type))
                    .map((s) => s.object as NamedNode);
                return false;
            },
            replaceQuadsPicker: (replacement: Quad): any => ({ subject, predicate }: Quad): boolean =>
                equals(subject, replacement.subject) && equals(predicate, replacement.predicate),
        });

        const idFunlets: Funlets = Object.freeze({
            allRDFPropertyStatements: (obj: Quad[] | undefined, predicate: SomeNode): Quad[] => {
                if (typeof obj === "undefined") {
                    return [];
                }

                if (predicate === rdfs.member) {
                    return obj.filter((s) => s.predicate === rdfs.member || s.predicate.value.startsWith(memberPrefix));
                }

                const t = [];
                for (let i = 0; i < obj.length; i++) {
                    if (equals(predicate, obj[i].predicate)) {
                        t.push(obj[i]);
                    }
                }
                return t;
            },
            flushFilter: (changeStamp: number): any => (s: Quad): boolean => {
                this.changeTimestamps[s.subject.id as number] = changeStamp;
                this.changeTimestamps[doc(s.subject).id as number] = changeStamp;
                return s.predicate === rdf.type;
            },
            processTypeQuad: (quad: Quad): boolean => {
                if (quad.predicate !== rdf.type) {
                    return false;
                }
                const subjId = quad.subject.id as number;
                if (!Array.isArray(this.typeCache[subjId])) {
                    this.typeCache[subjId] = [];
                }
                this.typeCache[subjId] = this.quadsFor((quad.subject as NamedNode))
                    .filter((s) => s.predicate === rdf.type)
                    .map((s) => s.object as NamedNode);
                return false;
            },
            replaceQuadsPicker: (replacement: Quad): any => ({ subject, predicate }: Quad): boolean =>
                subject === replacement.subject && predicate === replacement.predicate,
        });

        this.funlets = rdfFactory.supports[Feature.identity] ? idFunlets : defaultFunlets;

        g.addDataCallback(this.funlets.processTypeQuad.bind(this));
    }

    /**
     * Add statements to the store.
     * @param data Data to parse and add to the store.
     */
    public addQuads(data: Quad[]): Quad[] {
        if (!Array.isArray(data)) {
            throw new TypeError("An array of quads must be passed to addQuads");
        }

        return data.map((q) => this.store.add(q.subject, q.predicate, q.object, q.graph));
    }

    public addQuadruples(data: Quadruple[]): Quad[] {
        const statements = new Array(data.length);
        for (let i = 0, len = data.length; i < len; i++) {
            statements[i] = this.store.add(data[i][0], data[i][1], data[i][2], data[i][3]);
        }

        return statements;
    }

    public canon(term: SomeNode): SomeNode {
        return this.store.canon(term);
    }

    public defaultGraph(): SomeNode {
        return rdfFactory.defaultGraph();
    }

    /**
     * Find the first quad matching the given arguments.
     * Use null or undefined as a wild-card.
     */
    public find(subj: OptionalNode,
                pred: OptionalNamedNode,
                obj: OptionalTerm,
                graph: OptionalNode): Quad | undefined {
        return this.match(subj, pred, obj, graph, true)[0];
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
            .filter(this.funlets.flushFilter(changeStamp))
            .map(this.funlets.processTypeQuad);

        return processingBuffer;
    }

    /** @private */
    public getInternalStore(): RDFIndex {
        return this.store;
    }

    public match(subj: OptionalNode,
                 pred: OptionalNamedNode,
                 obj: OptionalTerm,
                 graph: OptionalNode,
                 justOne: boolean = false): Quad[] {
        return this.store.match(subj, pred, obj, graph, justOne) || [];
    }

    public processDelta(delta: Quadruple[]): Quad[] {
        const [
            addables,
            replacables,
            removables,
        ] = this.deltaProcessor(delta);

        this.removeQuads(removables);

        return this.replaceMatches(replacables).concat(this.addQuadruples(addables));
    }

    public removeResource(subject: SomeNode): void {
        this.touch(subject);
        this.typeCache[id(subject)] = [];
        this.removeQuads(this.quadsFor(subject));
    }

    public removeQuads(statements: Quad[]): void {
        this.store.removeQuads(statements);
    }

    /**
     * Removes an array of statements and inserts another.
     * Note: Be sure that the replacement contains the same subjects as the original to let the
     *  broadcast work correctly.
     * @access private This is in conflict with the typescript declaration due to the development of some experimental
     *                  features, but this method shouldn't be used nevertheless.
     * @param original The statements to remove from the store.
     * @param replacements The statements to add to the store.
     */
    public replaceQuads(original: Quad[], replacements: Quad[]): Quad[] {
        const uniqueStatements = new Array(replacements.length).filter(Boolean);
        for (const replacement of replacements) {
            const cond = original.some(this.funlets.replaceQuadsPicker);
            if (!cond) {
                uniqueStatements.push(replacement);
            }
        }

        this.removeQuads(original);
        // Remove statements not in the old object. Useful for replacing data loosely related to the main resource.
        for (let i = 0; i < uniqueStatements.length; i++) {
            this.store.removeMatches(
                uniqueStatements[i].subject,
                uniqueStatements[i].predicate,
                null,
                null,
            );
        }

        return this.addQuads(replacements);
    }

    public replaceMatches(statements: Quadruple[]): Quad[] {
        for (let i = 0; i < statements.length; i++) {
            this.removeQuads(this.match(
                statements[i][0],
                statements[i][1],
                null,
                null,
            ));
        }

        return this.addQuadruples(statements);
    }

    public getResourcePropertyRaw(subject: SomeNode, property: SomeNode | SomeNode[]): Quad[] {
        const props = this.quadsFor(subject);
        const allProps = this.funlets.allRDFPropertyStatements;
        if (Array.isArray(property)) {
            for (let i = 0; i < property.length; i++) {
                const values = allProps(props, property[i]);
                if (values.length > 0) {
                    return values;
                }
            }

            return EMPTY_ST_ARR as Quad[];
        }

        return allProps(props, property);
    }

    public getResourceProperties<TT extends Term = Term>(subject: SomeNode, property: SomeNode | SomeNode[]): TT[] {
        if (property === rdf.type) {
            return (this.typeCache[id(subject)] || []) as TT[];
        }

        return this
            .getResourcePropertyRaw(subject, property)
            .map((s) => s.object as TT);
    }

    public getResourceProperty<T extends Term = Term>(
        subject: SomeNode,
        property: SomeNode | SomeNode[],
    ): T | undefined {

        if (!Array.isArray(property) && equals(property, rdf.type)) {
            const entry = this.typeCache[id(subject)];

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
     * Searches the store for all the quads on {iri} (so not all statements relating to {iri}).
     * @param subject The identifier of the resource.
     */
    public quadsFor(subject: SomeNode): Quad[] {
        const sId = id(this.store.canon(subject));

        return typeof this.store.indices[QuadPosition.subject][sId] !== "undefined"
            ? this.store.indices[QuadPosition.subject][sId]
            : EMPTY_ST_ARR as Quad[];
    }

    public touch(iri: SomeNode): void {
        this.changeTimestamps[id(iri)] = Date.now();
        this.changeBuffer.push(rdfFactory.quad(iri, ll.nop, ll.nop));
        this.changeBufferCount++;
    }

    public workAvailable(): number {
        return this.deltas.length + this.changeBufferCount;
    }
}
