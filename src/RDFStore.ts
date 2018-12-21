import {
    Formula,
    graph,
    IndexedFormula,
    NamedNode,
    Node,
    OptionalNode,
    SomeTerm,
    Statement,
} from "rdflib";

import { ChangeBuffer, SomeNode } from "./types";
import { allRDFPropertyStatements, getPropBestLang } from "./utilities";
import { defaultNS, defaultNS as NS } from "./utilities/constants";
import { patchRDFLibStoreWithOverrides, patchRDFLibStoreWithProxy } from "./utilities/monkeys";

const EMPTY_ST_ARR: ReadonlyArray<Statement> = Object.freeze([]);

/**
 * Provides a clean consistent interface to stored (RDF) data.
 */
export class RDFStore implements ChangeBuffer {
    public changeBuffer: Statement[] = new Array(100);
    public changeBufferCount: number = 0;

    private langPrefs: string[] = Array.from(typeof navigator !== undefined
        ? (navigator.languages || [navigator.language])
        : ["en"]);
    private store: IndexedFormula = graph();
    private typeCache: { [k: string]: NamedNode[] } = {};

    constructor() {
        this.processDelta = this.processDelta.bind(this);

        const g = graph();
        if (typeof Proxy !== "undefined") {
            this.store = patchRDFLibStoreWithProxy(g, this);
        } else {
            this.store = patchRDFLibStoreWithOverrides(g, this);
        }
        this.store.newPropertyAction(NS.rdf("type"), this.processTypeStatement.bind(this));
    }

    /**
     * Add statements to the store.
     * @param data Data to parse and add to the store.
     */
    public addStatements(data: Statement[]): void {
        if (Array.isArray(data)) {
            this.store.add(data);
        } else {
            throw new TypeError("An array of statements must be passed to addStatements");
        }
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
        if (this.changeBufferCount === 0) {
            return EMPTY_ST_ARR as Statement[];
        }
        const processingBuffer = this.changeBuffer;
        this.changeBuffer = new Array(100);
        this.changeBufferCount = 0;
        processingBuffer
            .filter((s) => s.predicate === NS.rdf("type"))
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

    public processDelta(statements: Statement[]): Promise<void> {
        const addGraphIRIS = [NS.ll("add").value];
        const replaceGraphIRIS = [undefined, NS.ll("replace").value, "chrome:theSession"];
        const addables = statements.filter((s) => addGraphIRIS.includes(s.why.value));
        const replacables = statements.filter((s) => replaceGraphIRIS.includes(s.why.value));
        const removables = statements
            .filter((s) => NS.ll("remove").value === s.why.value)
            .reduce((tot: Statement[], cur) => {
                const matches = this.store.match(cur.subject, cur.predicate, null, null);

                return tot.concat(matches);
            }, []);
        this.removeStatements(removables);
        this.replaceMatches(replacables);
        this.addStatements(addables);

        return Promise.resolve();
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
        const uniqueStatements = new Array(replacement.length);
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

    public replaceMatches(statements: Statement[]): void {
        for (let i = 0; i < statements.length; i++) {
            this.removeStatements(this.match(
                statements[i].subject,
                statements[i].predicate,
                undefined,
                undefined,
            ));
        }
        for (let i = 0; i < statements.length; i++) {
            this.store.add(statements[i].subject, statements[i].predicate, statements[i].object);
        }
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
            return this.typeCache[subject.toString()] || [];
        }

        return this
            .getResourcePropertyRaw(subject, property)
            .map((s) => s.object);
    }

    public getResourceProperty(subject: SomeNode, property: SomeNode | SomeNode[]): SomeTerm | undefined {
        if (property === NS.rdf("type")) {
            const entry = this.typeCache[subject.toString()];
            return entry ? entry[0] : undefined;
        }
        const rawProp = this.getResourcePropertyRaw(subject, property);
        if (rawProp.length === 0) {
            return undefined;
        }

        return getPropBestLang(rawProp, this.langPrefs);
    }

    /**
     * Searches the store for all the statements on {iri} (so not all statements relating to {iri}).
     * @param subject The identifier of the resource.
     */
    public statementsFor(subject: SomeNode): Statement[] {
        const canon = this.store.canon(subject).toString();

        return typeof this.store.subjectIndex[canon] !== "undefined"
            ? this.store.subjectIndex[canon]
            : EMPTY_ST_ARR as Statement[];
    }

    public workAvailable(): number {
        return this.changeBufferCount;
    }

    /**
     * Builds a cache of types per resource. Can be omitted when compiled against a well known service.
     */
    private processTypeStatement(_formula: Formula | undefined,
                                 subj: SomeTerm,
                                 _pred: NamedNode,
                                 obj?: SomeTerm,
                                 _why?: Node): boolean {
        const sSubj = subj.toString();
        if (!Array.isArray(this.typeCache[sSubj])) {
            this.typeCache[sSubj] = [obj as NamedNode];
            return false;
        }
        this.typeCache[sSubj] = this.statementsFor((subj as NamedNode))
            .filter((s) => s.predicate === defaultNS.rdf("type"))
            .map((s) => s.object as NamedNode);
        if (obj) {
            this.typeCache[sSubj].push((obj as NamedNode));
        }
        return false;
    }
}
