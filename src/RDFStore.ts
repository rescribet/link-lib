import {
    DataFactory,
    HexPos,
    Hextuple,
    JSNamedNode,
    Literal,
    QuadPosition,
    Resource,
} from "@ontologies/core";
import ld from "@ontologies/ld";
import rdf from "@ontologies/rdf";

import ll from "./ontology/ll";
import rdfFactory, {
    OptionalNamedNode,
    OptionalNode,
    OptionalTerm,
    Quad,
} from "./rdf";
import { InternalHextuple } from "./store/BasicStore";
import { deltaProcessor } from "./store/deltaProcessor";
import RDFIndex from "./store/RDFIndex";
import { ChangeBuffer, DeltaProcessor, StoreProcessor } from "./types";
import { allRDFPropertyStatements, getPropBestLang } from "./utilities";
import { hexToQuad, literalFromHex, literalFromResource, quadToHex } from "./utilities/hex";
import { patchRDFLibStoreWithOverrides } from "./utilities/monkeys";

const EMPTY_ST_ARR: ReadonlyArray<Hextuple> = Object.freeze([]);

export interface RDFStoreOpts {
    deltaProcessorOpts?: { [k: string]: JSNamedNode[] };
    innerStore?: RDFIndex;
}

/**
 * Provides a clean consistent interface to stored (RDF) data.
 */
export class RDFStore implements ChangeBuffer, DeltaProcessor {
    public changeBuffer: Hextuple[] = new Array(100);
    public changeBufferCount: number = 0;
    /**
     * Record of the last time a resource was flushed.
     *
     * @note Not to be confused with the last change in the store, which might be later than the flush time.
     */
    public changeTimestamps: { [k: string]: number } = {};
    public typeCache: { [k: string]: JSNamedNode[] } = {};

    private deltas: Hextuple[][] = [];
    private deltaProcessor: StoreProcessor;
    private langPrefs: string[] = Array.from(typeof navigator !== "undefined"
        ? (navigator.languages || [navigator.language])
        : ["en"]);
    private store: RDFIndex = new RDFIndex();

    public get rdfFactory(): DataFactory {
        return rdfFactory;
    }
    public set rdfFactory(_: DataFactory) {
        throw new Error("Factory is global (see @ontologies/core)");
    }

    constructor({ deltaProcessorOpts, innerStore }: RDFStoreOpts = {}) {
        this.processDelta = this.processDelta.bind(this);

        const g = innerStore || new RDFIndex();
        g.addDataCallback(this.processTypeQuad.bind(this));
        this.store = patchRDFLibStoreWithOverrides(g, this);

        const defaults =  {
            addGraphIRIS: [ld.add, ll.add],
            purgeGraphIRIS: [ld.purge, ll.purge],
            removeGraphIRIS: [ld.remove, ll.remove],
            replaceGraphIRIS: [
                ld.replace,
                ll.replace,
                rdfFactory.defaultGraph(),
            ],
            sliceGraphIRIS: [ld.slice, ll.slice],
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
    public addQuads(data: Quad[]): Quad[] {
        if (!Array.isArray(data)) {
            throw new TypeError("An array of quads must be passed to addQuads");
        }

        return this.store.addHexes(data.map(quadToHex)).map(hexToQuad);
    }

    public addHextuples(data: Hextuple[]): Hextuple[] {
        const statements = new Array(data.length);
        for (let i = 0, len = data.length; i < len; i++) {
            statements[i] = this.store.addHex(data[i]);
        }

        return statements;
    }

    public canon(term: Resource): Resource {
        return this.store.canon(term);
    }

    public defaultGraph(): Resource {
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
    public flush(): Hextuple[] {
        const deltas = this.deltas;
        this.deltas = [];

        for (let i = 0; i < deltas.length; i++) {
            this.processDelta(deltas[i]);
        }

        if (this.changeBufferCount === 0) {
            return EMPTY_ST_ARR as Hextuple[];
        }
        const processingBuffer = this.changeBuffer;
        this.changeBuffer = new Array(100);
        this.changeBufferCount = 0;
        const changeStamp = Date.now();
        processingBuffer
            .filter((hex) => {
                this.changeTimestamps[hex[HexPos.subject]] = changeStamp;
                return hex[HexPos.predicate] === rdf.type;
            })
            .map((s) => this.processTypeQuad(s));

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

    public matchHex(
        subject: string | null,
        predicate: string | null,
        object: string | null,
        datatype: string | null,
        lang: string | null,
        graph: string | null,
        justOne: boolean = false,
    ): Hextuple[] {
        return this.store.matchHex(subject, predicate, object, datatype, lang, graph, justOne) || [];
    }

    public processDelta(delta: Hextuple[]): Hextuple[] {
        const [
            addables,
            replacables,
            removables,
        ] = this.deltaProcessor(delta);

        this.removeHexes(removables);

        return [...this.replaceMatches(replacables), ...this.addHextuples(addables)];
    }

    public removeResource(subject: Resource): void {
        this.touch(subject);
        this.typeCache[subject] = [];
        this.removeHexes(this.quadsFor(subject));
    }

    public removeHexes(statements: Hextuple[]): void {
        this.store.removeHexes(statements);
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
    public replaceQuads(original: Hextuple[], replacement: Hextuple[]): Hextuple[] {
        const uniqueStatements = new Array(replacement.length).filter(Boolean);
        for (let i = 0; i < replacement.length; i++) {
            const cond = original.some(
                ([ subject, predicate ]) => rdfFactory.equals(subject, replacement[i][HexPos.subject])
                    && rdfFactory.equals(predicate, replacement[i][HexPos.predicate]),
            );
            if (!cond) {
                uniqueStatements.push(replacement[i]);
            }
        }

        this.removeHexes(original);
        // Remove statements not in the old object. Useful for replacing data loosely related to the main resource.
        for (let i = 0; i < uniqueStatements.length; i++) {
            this.store.removeMatches(
                uniqueStatements[i].subject,
                uniqueStatements[i].predicate,
                null,
                null,
            );
        }

        return this.addHextuples(replacement);
    }

    public replaceMatches(statements: Hextuple[]): Hextuple[] {
        for (let i = 0; i < statements.length; i++) {
            this.removeHexes(this.matchHex(
                statements[i][0],
                statements[i][1],
                null,
                null,
                null,
                null,
            ));
        }

        return this.addHextuples(statements);
    }

    public getResourcePropertyRaw(subject: Resource, property: Resource | Resource[]): Hextuple[] {
        const props = this.quadsFor(subject);
        if (Array.isArray(property)) {
            for (let i = 0; i < property.length; i++) {
                const values = allRDFPropertyStatements(props, property[i]);
                if (values.length > 0) {
                    return values;
                }
            }

            return EMPTY_ST_ARR as Hextuple[];
        }

        return allRDFPropertyStatements(props, property);
    }

    public getResourceProperties<TT extends Literal = Literal>(
        subject: Resource,
        property: Resource | Resource[],
    ): TT[] {
        if (property === rdf.type) {
            return (this.typeCache[subject]?.map(literalFromResource) || []) as unknown as TT[];
        }

        return this
            .getResourcePropertyRaw(subject, property)
            .map((s) => literalFromHex(s) as unknown as TT);
    }

    public getResourceProperty<T extends Literal = Literal>(
        subject: Resource,
        property: Resource | Resource[],
    ): T | undefined {

        if (!Array.isArray(property) && property === rdf.type) {
            const entry = this.typeCache[subject];

            return entry ? entry[0] as unknown as T : undefined;
        }
        const rawProp = this.getResourcePropertyRaw(subject, property);
        if (rawProp.length === 0) {
            return undefined;
        }

        return getPropBestLang<T>(rawProp, this.langPrefs);
    }

    public queueDelta(delta: Hextuple[]): void {
        this.deltas.push(delta);
    }

    /**
     * Searches the store for all the quads on {iri} (so not all statements relating to {iri}).
     * @param subject The identifier of the resource.
     */
    public quadsFor(subject: Resource): Hextuple[] {
        const id = this.store.canon(subject);
        const index = this.store.indices[QuadPosition.subject][id];

        if (typeof index === "undefined") {
            return EMPTY_ST_ARR as Hextuple[];
        }

        const res = [];
        for (let i = 0; i < index.length; i++) {
            if (!(index[i] as unknown as InternalHextuple)[6]) {
                res.push(index[i]);
            }
        }

        return res;
    }

    public touch(iri: Resource): void {
        this.changeTimestamps[iri] = Date.now();
        this.changeBuffer.push(rdfFactory.quad(iri, ll.nop, ll.nop));
        this.changeBufferCount++;
    }

    public workAvailable(): number {
        return this.deltas.length + this.changeBufferCount;
    }

    /**
     * Builds a cache of types per resource. Can be omitted when compiled against a well known service.
     */
    private processTypeQuad([subject, predicate]: Hextuple): boolean {
        if (predicate !== rdf.type) {
            return false;
        }
        if (!Array.isArray(this.typeCache[subject])) {
            this.typeCache[subject] = [];
        }
        const next = [];
        const q = this.quadsFor(subject);
        for (let i = 0; i < q.length; i++) {
            if (q[i][HexPos.predicate] === rdf.type) {
                next.push(q[i][HexPos.object] as JSNamedNode);
            }
        }
        this.typeCache[subject] = next;

        return false;
    }
}
