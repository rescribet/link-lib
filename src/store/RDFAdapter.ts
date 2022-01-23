import rdfFactory, {
  DataFactory,
  NamedNode,
  Quad,
  QuadPosition,
  Quadruple,
  SomeTerm,
} from "@ontologies/core";

import { SomeNode } from "../types";
import { DataRecord, Id, idField, StructuredStore } from "./StructuredStore";

const EMPTY_ST_ARR: ReadonlyArray<Quad> = Object.freeze([]);

export interface RDFAdapterOpts {
  data?: Record<Id, DataRecord>;
  quads: Quadruple[];
  dataCallback: (quad: Quadruple) => void;
  rdfFactory: DataFactory;
}

export class RDFAdapter {
  public readonly rdfFactory: DataFactory;

  public readonly dataCallbacks: Array<(quad: Quadruple) => void>;
  public readonly removeCallback: ((quad: Quadruple) => void) | undefined;

  /** @private */
  public store: StructuredStore;
  /** @private */
  public storeGraph: NamedNode;

  constructor(opts: Partial<RDFAdapterOpts> = {}) {
    this.dataCallbacks = [];
    this.store = new StructuredStore("rdf:defaultGraph", opts.data);
    this.rdfFactory = opts.rdfFactory ?? rdfFactory;
    opts.quads?.forEach((q) => this.add(
        q[QuadPosition.subject],
        q[QuadPosition.predicate],
        q[QuadPosition.object],
        q[QuadPosition.graph],
    ));
    this.storeGraph = this.rdfFactory.namedNode(this.store.base);
  }

  public get quads(): Quadruple[] {
    return this.graphToQuads();
  }

  public add(
    subject: SomeNode,
    predicate: NamedNode,
    object: SomeTerm,
    _graph: SomeNode = this.rdfFactory.defaultGraph(),
  ): Quadruple {
    const asQuadruple: Quadruple = [subject, predicate, object, _graph];

    this.store.addField(subject.value, predicate.value, object);

    if (this.dataCallbacks) {
      for (const callback of this.dataCallbacks) {
        callback(asQuadruple);
      }
    }

    return asQuadruple;
  }

  public addDataCallback(callback: (q: Quadruple) => void): void {
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
  public remove(st: Quadruple): this {
    const value = this.store.getField(st[QuadPosition.subject].value, st[QuadPosition.predicate].value);
    if (value === undefined) {
      throw new Error(`Quad to be removed is not on store: ${st}`);
    }
    this.store.deleteFieldMatching(
        st[QuadPosition.subject].value,
        st[QuadPosition.predicate].value,
        st[QuadPosition.object],
    );

    return this;
  }

  /** Remove a quad from the store */
  public removeQuad(quad: Quadruple): this {
    this.store.deleteFieldMatching(
      quad[QuadPosition.subject].value,
      quad[QuadPosition.predicate].value,
      quad[QuadPosition.object],
    );

    if (this.removeCallback) {
      this.removeCallback(quad);
    }
    return this;
  }

  public removeQuads(quads: Quadruple[]): this {
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
    justOne: boolean = false,
  ): Quadruple[] {
    let quads: Quadruple[];

    if (subject && predicate) {
      const value = this.store.getField(subject.value, predicate.value);

      if (Array.isArray(value)) {
        quads = value.map((v) => [subject, predicate, v, this.storeGraph]);
      } else if (value) {
        quads = [[subject, predicate, value, this.storeGraph]];
      } else {
        quads = EMPTY_ST_ARR as unknown as Quadruple[];
      }
    } else {
      quads = this.graphToQuads();
    }

    const filter = (q: Quadruple): boolean =>
      (subject === null || q[QuadPosition.subject] === subject)
      && (predicate === null || q[QuadPosition.predicate] === predicate)
      && (object === null || q[QuadPosition.object] === object);

    if (justOne) {
      const res = quads.find(filter);
      return res ? [res] : EMPTY_ST_ARR as unknown as Quadruple[];
    }

    return quads.filter(filter);
  }

  public quadsForRecord(recordId: Id): Quadruple[] {
    const factory = this.rdfFactory;
    const record = this.store.getRecord(recordId);

    if (record === undefined) {
      return EMPTY_ST_ARR as unknown as Quadruple[];
    }

    const subject = recordId.includes(":")
      ? factory.namedNode(recordId)
      : factory.blankNode(recordId);

    const quadruples: Quadruple[] = [];

    for (const field in record) {
      if (!record.hasOwnProperty(field) || field === idField) {
        continue;
      }

      const value = record[field];
      const fieldTerm = factory.namedNode(field);
      if (Array.isArray(value)) {
        for (const v of value) {
          quadruples.push([subject, fieldTerm, v, this.storeGraph] as Quadruple);
        }
      } else {
        quadruples.push([subject, fieldTerm, value, this.storeGraph] as Quadruple);
      }
    }

    return quadruples;
  }

  public graphToQuads(): Quadruple[] {
    const qdrs = [];
    const data = this.store.data;

    for (const recordId in data) {
      if (!data.hasOwnProperty(recordId)) {
        continue;
      }

      qdrs.push(...this.quadsForRecord(recordId));
    }

    return qdrs;
  }
}
