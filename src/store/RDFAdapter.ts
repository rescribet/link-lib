import rdfFactory, {
  DataFactory,
  isNode,
  NamedNode,
  Quad,
  QuadPosition,
  Quadruple,
  SomeTerm,
} from "@ontologies/core";
import { sameAs } from "@ontologies/owl";

import { DataRecord, Id } from "../datastrucures/DataSlice";
import { SomeNode } from "../types";
import { isGlobalId, isLocalId } from "../utilities/slices";

import { idField, StructuredStore } from "./StructuredStore";

const EMPTY_ST_ARR: ReadonlyArray<Quad> = Object.freeze([]);

export interface RDFAdapterOpts {
  data?: Record<Id, DataRecord>;
  quads: Quadruple[];
  dataCallback: (quad: Quadruple) => void;
  onChange: (docId: string) => void;
  rdfFactory: DataFactory;
}

export class RDFAdapter {
  public readonly rdfFactory: DataFactory;

  public readonly recordCallbacks: Array<(recordId: Id) => void>;

  /** @private */
  public store: StructuredStore;
  /** @private */
  public storeGraph: NamedNode;

  constructor(opts: Partial<RDFAdapterOpts> = {}) {
    this.recordCallbacks = [];
    this.store = new StructuredStore(
      "rdf:defaultGraph",
      opts.data,
      (recordId: Id): void => {
        if (opts.onChange) {
          opts.onChange(recordId);
        }

        this.recordCallbacks.forEach((cb) => cb(recordId));
      },
    );
    this.rdfFactory = opts.rdfFactory ?? rdfFactory;
    opts.quads?.forEach((q) => this.add(
        q[QuadPosition.subject],
        q[QuadPosition.predicate],
        q[QuadPosition.object],
        q[QuadPosition.graph],
    ));
    this.addRecordCallback(this.handleAlias.bind(this));
    this.storeGraph = this.rdfFactory.namedNode(this.store.base);
  }

  /** @deprecated */
  public get quads(): Quadruple[] {
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

  /** @deprecated */
  public add(
    subject: SomeNode,
    predicate: NamedNode,
    object: SomeTerm,
    _graph: SomeNode = this.rdfFactory.defaultGraph(),
  ): Quadruple {
    const asQuadruple: Quadruple = [subject, predicate, object, _graph];

    this.store.addField(subject.value, predicate.value, object);

    return asQuadruple;
  }

  public addRecordCallback(callback: (recordId: Id) => void): void {
    this.recordCallbacks.push(callback);
  }

  public deleteRecord(subject: SomeNode): void {
    this.store.deleteRecord(subject.value);
  }

  /**
   * Remove a quad from the store
   * @deprecated
   */
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

  /** @deprecated */
  public removeQuads(quads: Quadruple[]): this {
    // Ensure we don't loop over the array we're modifying.
    const toRemove = quads.slice();
    for (let i = 0; i < toRemove.length; i++) {
      this.remove(toRemove[i]);
    }
    return this;
  }

  /** @deprecated */
  public match(
    aSubject: SomeNode | null,
    aPredicate: NamedNode | null,
    aObject: SomeTerm | null,
    justOne: boolean = false,
  ): Quadruple[] {
    const subject = aSubject ? this.primary(aSubject) : null;
    const predicate = aPredicate ? this.primary(aPredicate) as NamedNode : null;
    const object = aObject
      ? (isNode(aObject) ? this.primary(aObject) : aObject)
      : null;

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
    } else if (subject) {
      quads = this.quadsForRecord(subject.value);
    } else {
      quads = this.quads;
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

  /** @deprecated */
  public quadsForRecord(recordId: Id): Quadruple[] {
    const factory = this.rdfFactory;
    const record = this.store.getRecord(recordId);

    if (record === undefined) {
      return EMPTY_ST_ARR as unknown as Quadruple[];
    }

    const subject = isGlobalId(recordId)
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

  /** @private */
  public primary(node: SomeNode): SomeNode {
    const p = this.store.primary(node.value);

    if (isLocalId(p)) {
      return this.rdfFactory.blankNode(p);
    } else {
      return this.rdfFactory.namedNode(p);
    }
  }

  private handleAlias(recordId: Id): void {
      const rawRecord = this.store.data[recordId];
      if (rawRecord === undefined) {
        return;
      }
      const sameAsValue = rawRecord[sameAs.value];
      if (sameAsValue) {
        this.store.setAlias(
          rawRecord._id.value,
          (Array.isArray(sameAsValue) ? sameAsValue[0] : sameAsValue).value,
        );
      }
  }
}
