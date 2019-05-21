import { Quadruple } from "n-quads-parser";
import {
    Formula,
    graph,
    IndexedFormula,
    NamedNode,
    Node,
    OptionalNode,
    SomeTerm,
    Statement,
    Term,
} from "rdflib";

import { ChangeBuffer, DeltaProcessor, SomeNode } from "./types";
import { allRDFPropertyStatements, getPropBestLang } from "./utilities";
import { defaultNS as NS } from "./utilities/constants";
import { patchRDFLibStoreWithOverrides } from "./utilities/monkeys";

const EMPTY_ST_ARR: ReadonlyArray<Statement> = Object.freeze([]);

/**
 * Provides a clean consistent interface to stored (RDF) data.
 */
export class RDFStore implements ChangeBuffer, DeltaProcessor {
    public changeBuffer: Statement[] = new Array(100);
    public changeBufferCount: number = 0;
    /**
     * Record of the last time a resource was flushed.
     *
     * @note Not to be confused with the last change in the store, which might be later than the flush time.
     */
    public changeTimestamps: Uint32Array = new Uint32Array(0x100000);
    public typeCache: NamedNode[][] = [];

    private addGraphIRIS: any[];
    private deltas: Quadruple[][] = [];
    private replaceGraphIRIS: any[];
    private removeGraphIRIS: any[];
    private langPrefs: string[] = Array.from(typeof navigator !== "undefined"
        ? (navigator.languages || [navigator.language])
        : ["en"]);
    private store: IndexedFormula = graph();

    constructor() {
        this.addGraphIRIS = [NS.ll("add")];
        this.replaceGraphIRIS = [
            undefined,
            NS.ll("replace"),
            this.store.defaultGraphIRI,
        ];
        this.removeGraphIRIS = [NS.ll("remove")];
        this.processDelta = this.processDelta.bind(this);

        const g = graph();
        this.store = patchRDFLibStoreWithOverrides(g, this);

        this.store.newPropertyAction(NS.rdf("type"), this.processTypeStatement.bind(this));
    }

    /**
     * Add statements to the store.
     * @param data Data to parse and add to the store.
     */
    public addStatements(data: Statement[]): void {
        if (!Array.isArray(data)) {
            throw new TypeError("An array of statements must be passed to addStatements");
        }

        for (let i = 0, len = data.length; i < len; i++) {
            this.store.addStatement(data[i]);
        }
    }

    public addQuads(data: Quadruple[]): Statement[] {
        const statements = new Array(data.length);
        for (let i = 0, len = data.length; i < len; i++) {
            statements[i] = this.store.add(data[i][0], data[i][1], data[i][2]);
        }

        return statements;
    }

    public any(subj: OptionalNode, pred?: OptionalNode, obj?: OptionalNode, why?: OptionalNode): SomeTerm | undefined {
        return this.store.any(subj, pred, obj, why);
    }

    public anyStatementMatching(subj: OptionalNode,
                                pred?: OptionalNode,
                                obj?: OptionalNode,
                                why?: OptionalNode): Statement | undefined {
        return this.store.anyStatementMatching(subj, pred, obj, why);
    }

    public anyValue(subj: OptionalNode,
                    pred?: OptionalNode,
                    obj?: OptionalNode,
                    why?: OptionalNode): string | undefined {
        return this.store.anyValue(subj, pred, obj, why);
    }

    public canon(term: Node): Node {
        return this.store.canon(term);
    }

    /**
     * Flushes the change buffer to the return value.
     * @return Statements held in memory since the last flush.
     */
    public flush(): Statement[] {
        const deltas = this.deltas;
        this.deltas = [];

        for (let i = 0; i < deltas.length; i++) {
            this.processDelta(deltas[i]);
        }

        if (this.changeBufferCount === 0) {
            return EMPTY_ST_ARR as Statement[];
        }
        const processingBuffer = this.changeBuffer;
        this.changeBuffer = new Array(100);
        this.changeBufferCount = 0;
        const changeStamp = Date.now();
        processingBuffer
            .filter((s) => {
                this.changeTimestamps[s.subject.sI] = changeStamp;
                return s.predicate === NS.rdf("type");
            })
            .map((s) => this.processTypeStatement(undefined, s.subject, s.predicate, undefined, undefined));
        return processingBuffer;
    }

    /** @private */
    public getInternalStore(): IndexedFormula {
        return this.store;
    }

    public match(subj: OptionalNode,
                 pred?: OptionalNode,
                 obj?: OptionalNode,
                 why?: OptionalNode): Statement[] {
        return this.store.match(subj, pred, obj, why) || [];
    }

    public processDelta(delta: Quadruple[]): Statement[] {
        const addables = [];
        const replacables = [];
        const removables = [];

        let quad;
        for (let i = 0, len = delta.length; i < len; i++) {
            quad = delta[i];

            if (!quad) {
                continue;
            }

            if (this.addGraphIRIS.includes(quad[3])) {
                addables.push(quad);
            } else if (this.replaceGraphIRIS.includes(quad[3])) {
                replacables.push(quad);
            } else if (this.removeGraphIRIS.includes(quad[3])) {
                const matches = this.store.match(quad[0], quad[1], null, null);
                removables.push(...matches);
            }
        }

        this.removeStatements(removables);

        return this.replaceMatches(replacables).concat(this.addQuads(addables));
    }

    public removeResource(subject: SomeNode): void {
        this.touch(subject);
        this.typeCache[subject.sI] = [];
        this.removeStatements(this.statementsFor(subject));
    }

    public removeStatements(statements: Statement[]): void {
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
    public replaceStatements(original: Statement[], replacement: Statement[]): void {
        const uniqueStatements = new Array(replacement.length).filter(Boolean);
        for (let i = 0; i < replacement.length; i++) {
            const cond = original.some(
                (o) => o.subject.sameTerm(replacement[i].subject) && o.predicate.sameTerm(replacement[i].predicate),
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

    public replaceMatches(statements: Quadruple[]): Statement[] {
        for (let i = 0; i < statements.length; i++) {
            this.removeStatements(this.match(
                statements[i][0],
                statements[i][1],
                undefined,
                undefined,
            ));
        }
        const matches = new Array(statements.length);
        for (let i = 0, len = statements.length; i < len; i++) {
            matches[i] = this.store.add(statements[i][0], statements[i][1], statements[i][2]);
        }

        return matches;
    }

    public getResourcePropertyRaw(subject: SomeNode, property: SomeNode | SomeNode[]): Statement[] {
        const props = this.statementsFor(subject);
        if (Array.isArray(property)) {
            for (let i = 0; i < property.length; i++) {
                const values = allRDFPropertyStatements(props, property[i]);
                if (values.length > 0) {
                    return values;
                }
            }

            return EMPTY_ST_ARR as Statement[];
        }

        return allRDFPropertyStatements(props, property);
    }

    public getResourceProperties(subject: SomeNode, property: SomeNode | SomeNode[]): SomeTerm[] {
        if (property === NS.rdf("type")) {
            return this.typeCache[subject.sI] || [];
        }

        return this
            .getResourcePropertyRaw(subject, property)
            .map((s) => s.object);
    }

    public getResourceProperty(subject: SomeNode, property: SomeNode | SomeNode[]): SomeTerm | undefined {
        if (property === NS.rdf("type")) {
            const entry = this.typeCache[subject.sI];
            return entry ? entry[0] : undefined;
        }
        const rawProp = this.getResourcePropertyRaw(subject, property);
        if (rawProp.length === 0) {
            return undefined;
        }

        return getPropBestLang(rawProp, this.langPrefs);
    }

    public queueDelta(delta: Quadruple[]): void {
        this.deltas.push(delta);
    }

    /**
     * Searches the store for all the statements on {iri} (so not all statements relating to {iri}).
     * @param subject The identifier of the resource.
     */
    public statementsFor(subject: SomeNode): Statement[] {
        const canon = (this.store.canon(subject) as Term).sI;

        return typeof this.store.subjectIndex[canon] !== "undefined"
            ? this.store.subjectIndex[canon]
            : EMPTY_ST_ARR as Statement[];
    }

    public touch(iri: SomeNode): void {
        this.changeTimestamps[iri.sI] = Date.now();
        this.changeBuffer.push(new Statement(iri, NS.ll("nop"), NS.ll("nop")));
        this.changeBufferCount++;
    }

    public workAvailable(): number {
        return this.deltas.length + this.changeBufferCount;
    }

    /**
     * Builds a cache of types per resource. Can be omitted when compiled against a well known service.
     */
    private processTypeStatement(_formula: Formula | undefined,
                                 subj: SomeNode,
                                 _pred: NamedNode,
                                 obj?: SomeTerm,
                                 _why?: Node): boolean {
        if (!Array.isArray(this.typeCache[subj.sI])) {
            this.typeCache[subj.sI] = [obj as NamedNode];
            return false;
        }
        this.typeCache[subj.sI] = this.statementsFor((subj as NamedNode))
            .filter((s) => s.predicate === NS.rdf("type"))
            .map((s) => s.object as NamedNode);
        if (obj) {
            this.typeCache[subj.sI].push((obj as NamedNode));
        }
        return false;
    }
}
