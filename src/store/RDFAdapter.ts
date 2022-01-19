import rdfFactory, {
  DataFactory,
  NamedNode,
  Quad,
  SomeTerm,
} from "@ontologies/core";

import { SomeNode } from "../types";
import { IndexedFormulaOpts } from "./BasicStore";
import { Id, StructuredStore } from "./StructuredStore";

const EMPTY_ST_ARR: ReadonlyArray<Quad> = Object.freeze([]);

export class RDFAdapter {
  public readonly rdfFactory: DataFactory;

  public readonly dataCallbacks: Array<(quad: Quad) => void>;
  public readonly removeCallback: ((quad: Quad) => void) | undefined;

  /** @private */
  public store: StructuredStore = new StructuredStore();

  constructor(opts: Partial<IndexedFormulaOpts> = {}) {
    this.dataCallbacks = [];
    this.rdfFactory = opts.rdfFactory ?? rdfFactory;
    opts.quads?.forEach((q) => this.add(q.subject, q.predicate, q.object, q.graph));
  }

  public get quads(): Quad[] {
    return this.graphToQuads();
  }

  public add(
    subject: SomeNode,
    predicate: NamedNode,
    object: SomeTerm,
    _graph: SomeNode = this.rdfFactory.defaultGraph(),
  ): Quad {
    const asQuad = this.rdfFactory.quad(subject, predicate, object);

    this.store.addField(subject.value, predicate.value, object);

    if (this.dataCallbacks) {
      for (const callback of this.dataCallbacks) {
        callback(asQuad);
      }
    }

    return asQuad;
  }

  public addDataCallback(callback: (q: Quad) => void): void {
    this.dataCallbacks.push(callback);
  }

  public deleteRecord(subject: SomeNode): void {
    const quads = this.quadsForRecord(subject.value);

    if (quads.length === 0) {
      return;
    }

    this.store.deleteRecord(subject.value);
    if (this.removeCallback) {
      for (const q of quads) {
        this.removeCallback(q);
      }
    }
  }

  /** Remove a quad from the store */
  public remove(st: Quad): this {
    const sts = this.match(
      st.subject,
      st.predicate,
      st.object,
      null,
    );
    if (!sts.length) {
      throw new Error(`Quad to be removed is not on store: ${st}`);
    }
    this.removeQuad(sts[0]);

    return this;
  }

  /** Remove a quad from the store */
  public removeQuad(quad: Quad): this {
    this.store.deleteFieldMatching(quad.subject.value, quad.predicate.value, quad.object);

    if (this.removeCallback) {
      this.removeCallback(quad);
    }
    return this;
  }

  public removeQuads(quads: Quad[]): this {
    // Ensure we don't loop over the array we're modifying.
    const toRemove = quads.slice();
    for (let i = 0; i < toRemove.length; i++) {
      this.remove(toRemove[i]);
    }
    return this;
  }

  public match(
    subject: SomeNode | null,
    predicate: NamedNode | null,
    object: SomeTerm | null,
    graph: SomeNode | null = this.rdfFactory.defaultGraph(),
    justOne: boolean = false,
  ): Quad[] {
    let quads = [];

    if (subject && predicate) {
      const value = this.store.getField(subject.value, predicate.value);

      if (Array.isArray(value)) {
        quads = value.map((v) => this.rdfFactory.quad(subject, predicate, v));
      } else if (value) {
        quads = [this.rdfFactory.quad(subject, predicate, value)];
      } else {
        quads = EMPTY_ST_ARR as Quad[];
      }
    } else {
      quads = this.graphToQuads();
    }

    const factory = this.rdfFactory;
    const filter = (q: Quad): boolean =>
      (subject === null || factory.equals(q.subject, subject))
      && (predicate === null || factory.equals(q.predicate, predicate))
      && (object === null || factory.equals(q.object, object))
      && (graph === null || factory.equals(q.graph, graph));

    if (justOne) {
      const res = quads.find(filter);
      return res ? [res] : EMPTY_ST_ARR as Quad[];
    }

    return quads.filter(filter);
  }

  public quadsForRecord(recordId: Id): Quad[] {
    const factory = this.rdfFactory;
    const record = this.store.getRecord(recordId);

    if (record === undefined) {
      return EMPTY_ST_ARR as Quad[];
    }

    const subject = recordId.includes(":")
      ? factory.namedNode(recordId)
      : factory.blankNode(recordId);

    return Object
      .entries(record)
      .flatMap(([field, value]) => Array.isArray(value)
        ? value.map((v) => factory.quad(subject, factory.namedNode(field), v))
        : factory.quad(subject, factory.namedNode(field), value),
      );
  }

  public graphToQuads(): Quad[] {
    return Object
      .keys(this.store.data)
      .flatMap((resource) => this.quadsForRecord(resource));
  }
}
