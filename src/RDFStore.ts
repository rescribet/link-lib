import {
    BlankNode,
    Formula,
    graph,
    IndexedFormula,
    NamedNode,
    Node,
    SomeTerm,
    Statement,
} from "rdflib";

import { SomeNode } from "./types";
import {
    allRDFPropertyStatements,
    defaultNS as NS,
    getPropBestLang,
    namedNodeByIRI,
} from "./utilities";

const EMPTY_ST_ARR: ReadonlyArray<Statement> = Object.freeze([]);

function normalizeTerm(term: SomeTerm | undefined): SomeTerm | undefined {
    if (term && term.termType === "NamedNode") {
        return namedNodeByIRI(term.value) || term;
    }
    return term;
}

/**
 * Provides a clean consistent interface to stored (RDF) data.
 */
export class RDFStore {
    private changeBuffer: Statement[] = new Array(100);
    private changeBufferCount: number = 0;
    private langPrefs: string[] = ["nl", "en", "de"];
    private store: IndexedFormula = graph();
    private typeCache: { [k: string]: NamedNode[] } = {};

    constructor() {
        const g = graph();
        this.store = new Proxy(g, {
            get: (target: any, prop: string): any => {
                if (prop === "add") {
                    return (subj: NamedNode | BlankNode, pred: NamedNode, obj: SomeTerm, why: Node):
                        IndexedFormula | null | Statement => {
                        if (Array.isArray(subj)) {
                            return target.add(subj);
                        }

                        return target.add(
                            normalizeTerm(subj),
                            normalizeTerm(pred),
                            normalizeTerm(obj),
                            why,
                        );
                    };
                }

                return target[prop as any];
            },
        });

        g.statements = new Proxy(g.statements, {
            get: (target: Statement[], prop: string): any => {
                if (prop === "push") {
                    return (elem: any): number => {
                        this.changeBuffer[this.changeBufferCount] = elem;
                        this.changeBufferCount++;
                        return target.push(elem);
                    };
                } else if (prop === "splice") {
                    return (index: any, len: any): Statement[] => {
                        const rem = target.splice(index, len);
                        this.changeBuffer.push(...rem);
                        this.changeBufferCount += len;
                        return rem;
                    };
                }

                return target[prop as any];
            },
        });
        this.store.newPropertyAction(NS.rdf("type"), this.processTypeStatement.bind(this));
    }

    /**
     * Add statements to the store
     * @param data Data to parse and add to the store.
     */
    public addStatements(data: Statement[]): void {
        if (Array.isArray(data)) {
            this.store.add(data);
        } else {
            throw new TypeError("An array of statements must be passed to addStatements");
        }
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
        return processingBuffer;
    }

    public getInternalStore(): IndexedFormula {
        return this.store;
    }

    public removeStatements(statements: Statement[]): void {
        /* FIXME: There seems to be a bug in rdf which doesn't remove all statements on the try, but an additional call
           to `remove` seems to do the job. */
        this
            .store
            .remove(statements)
            .remove(statements);
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
        const uniqueStatements = replacement
            .filter((s) => !original.some(
                (o) => o.subject.sameTerm(s.subject) && o.predicate.sameTerm(s.predicate),
            ));

        this.removeStatements(original);
        // Remove statements not in the old object. Useful for replacing data loosely related to the main resource.
        uniqueStatements.forEach((s) => this.store.removeMatches(s.subject, s.predicate));

        return this.addStatements(replacement);
    }

    public getResourcePropertyRaw(subject: SomeNode, property: SomeNode | SomeNode[]): Statement[] {
        const props = this.statementsFor(subject);
        if (Array.isArray(property)) {
            for (const prop of property) {
                const values = allRDFPropertyStatements(props, prop);
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
            return this.typeCache[subject.toString()][0];
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
    private processTypeStatement(_formula: Formula,
                                 subj: SomeTerm,
                                 _pred: NamedNode,
                                 obj: SomeTerm,
                                 _why: Node): boolean {
        const sSubj = subj.toString();
        if (!Array.isArray(this.typeCache[sSubj])) {
            this.typeCache[sSubj] = [obj as NamedNode];
            return false;
        }
        this.typeCache[sSubj].push(obj as NamedNode);
        return false;
    }
}
