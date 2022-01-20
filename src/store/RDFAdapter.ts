import rdfFactory, {
  DataFactory,
  NamedNode,
  Quad,
  QuadPosition,
  Quadruple,
  SomeTerm,
} from "@ontologies/core";

import { SomeNode } from "../types";
import { Id, StructuredStore } from "./StructuredStore";

const EMPTY_ST_ARR: ReadonlyArray<Quad> = Object.freeze([]);

export interface RDFAdapterOpts {
  quads: Quadruple[];
  dataCallback: (quad: Quadruple) => void;
  rdfFactory: DataFactory;
}

export class RDFAdapter {
  public readonly rdfFactory: DataFactory;

  public readonly dataCallbacks: Array<(quad: Quadruple) => void>;
  public readonly removeCallback: ((quad: Quadruple) => void) | undefined;

  /** @private */
  public store: StructuredStore = new StructuredStore();
  /** @private */
  public storeGraph: NamedNode;

  constructor(opts: Partial<RDFAdapterOpts> = {}) {
    this.dataCallbacks = [];
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
    const sts = this.match(
      st[QuadPosition.subject],
      st[QuadPosition.predicate],
      st[QuadPosition.object],
    );
    if (!sts.length) {
      throw new Error(`Quad to be removed is not on store: ${st}`);
    }
    this.removeQuad(sts[0]);

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

    const factory = this.rdfFactory;
    const filter = (q: Quadruple): boolean =>
      (subject === null || factory.equals(q[QuadPosition.subject], subject))
      && (predicate === null || factory.equals(q[QuadPosition.predicate], predicate))
      && (object === null || factory.equals(q[QuadPosition.object], object));

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

    return Object
      .entries(record)
      .map(([field, value]) => Array.isArray(value)
        ? value.map((v) => [subject, factory.namedNode(field), v, this.storeGraph] as Quadruple)
        : [[subject, factory.namedNode(field), value, this.storeGraph] as Quadruple],
      ).flat(1);
  }

  public graphToQuads(): Quadruple[] {
    return Object
      .keys(this.store.data)
      .flatMap((resource) => this.quadsForRecord(resource));
  }
}
