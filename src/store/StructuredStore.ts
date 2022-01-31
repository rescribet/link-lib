import "../__tests__/useFactory";

import rdfFactory, { SomeTerm } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";

import { SomeNode } from "../types";
import { normalizeType } from "../utilities";
import { RecordJournal } from "./RecordJournal";
import { RecordState } from "./RecordState";
import { RecordStatus } from "./RecordStatus";

export type Id = string;
export type FieldId = string;
export type MultimapTerm = SomeTerm[];
export type FieldValue = SomeTerm | MultimapTerm;
export type DataRecord = { _id: SomeNode } & Record<string, FieldValue>;
export type DataSlice = Record<Id, DataRecord>;

export const idField = "_id";
const member = rdfs.member.value;
const memberPrefix = rdf.ns("_").value;
const namedNode = rdfFactory.namedNode.bind(rdfFactory);
const blankNode = rdfFactory.blankNode.bind(rdfFactory);

const merge = (a: SomeTerm | MultimapTerm | undefined, b: SomeTerm | MultimapTerm): SomeTerm | MultimapTerm => {
  if (Array.isArray(a)) {
    return Array.from(new Set([...a, ...normalizeType(b)]));
  } else if (a) {
    return Array.from(new Set([a, ...normalizeType(b)]));
  } else {
    return b;
  }
};

const getSortedFieldMembers = (record: DataRecord): MultimapTerm => {
  const values: FieldValue = [];
  const sortedEntries = Object
      .entries(record)
      .sort(([k1], [k2]) => {
        const a = k1.split(memberPrefix).pop() ?? k1;
        const b = k2.split(memberPrefix).pop() ?? k2;

        return a < b ? -1 : (a > b ? 1 : 0);
      });
  for (const [f, v] of sortedEntries) {
    if (f === member || f.startsWith(memberPrefix)) {
      values.push(...normalizeType(v));
    }
  }

  return values;
};

export class StructuredStore {
  /**
   * The base URI of the data.
   */
  public base: string;

  /** @private */
  public data: Record<Id, DataRecord>;

  /** @private */
  public journal: RecordJournal;

  private aliases: Record<string, Id & FieldId> = {};

  constructor(
      base: string = "rdf:defaultGraph",
      data: Record<Id, DataRecord> | undefined = {},
      onChange: (docId: string) => void = (): void => undefined,
  ) {
    this.base = base;
    this.data = data ?? {};
    this.journal = new RecordJournal(onChange);
    for (const key in this.data) {
      if (this.data.hasOwnProperty(key)) {
        this.journal.transition(key, RecordState.Present);
      }
    }
  }

  public getStatus(recordId: Id): RecordStatus {
    return this.journal.get(this.primary(recordId));
  }

  public transition(recordId: Id, state: RecordState): void {
    this.journal.transition(this.primary(recordId), state);
  }

  public touch(recordId: Id): void {
    this.journal.touch(this.primary(recordId));
  }

  public deleteRecord(recordId: Id): void {
    const primary = this.primary(recordId);
    this.journal.transition(primary, RecordState.Absent);
    delete this.data[primary];
  }

  public getField(recordId: Id, field: FieldId): FieldValue | undefined {
    if (field === member) {
      const record = this.getRecord(recordId);
      if (record === undefined) {
        return undefined;
      }

      return getSortedFieldMembers(record);
    } else {
      return this.getRecord(recordId)?.[this.primary(field)];
    }
  }

  public setField(recordId: Id, field: FieldId, value: FieldValue): void {
    if (field === idField) {
      throw new Error("Can't set system fields");
    }
    this.initializeRecord(recordId);
    this.setRecord(recordId, {
      ...this.getRecord(recordId)!,
      [field]: value,
    });
  }

  /** @deprecated */
  public addField(recordId: Id, field: FieldId, value: SomeTerm): void {
    if (field === idField) {
      throw new Error("Can't set system fields");
    }
    this.initializeRecord(recordId);

    const existingRecord = this.getRecord(recordId)!;
    const existingValue = existingRecord?.[field];

    const combined = Array.isArray(existingValue)
      ? existingValue.includes(value) ? existingValue : [...existingValue, value]
      : (existingValue !== undefined && existingValue !== value)
          ? [existingValue, value] :
          value;

    this.setRecord(recordId, {
      ...existingRecord,
      [field]: combined,
    });
  }

  public deleteField(recordId: Id, field: FieldId): void {
    if (this.getField(recordId, field) === undefined) {
      return;
    }

    const next = {
      ...this.getRecord(recordId)!,
    };
    delete next[field];
    this.setRecord(recordId, next);
  }

  /** @deprecated */
  public deleteFieldMatching(recordId: Id, field: FieldId, value: SomeTerm): void {
    const current = this.getField(recordId, field);
    if (current === undefined) {
      return;
    }

    if (Array.isArray(current) ? !current.includes(value) : current !== value) {
      return;
    }

    if (Array.isArray(current) && current.filter((s) => s !== value).length > 0) {
      this.setField(recordId, field, current.filter((s) => s !== value));
    } else {
      this.deleteField(recordId, field);
    }
  }

  /**
   * Returns the Id which is used to store the data under.
   * @internal
   */
  public primary<T extends Id | FieldId>(id: T): T {
    return (this.aliases[id] ?? id) as T;
  }

  /**
   * Creates a new store with {previous} aliased to the topmost alias of {current}.
   * Aliasing only applies to records.
   * Data from {current} will be overwritten by {previous}.
   * Any previous alias will be ignored, circular aliasing will be ignored.
   * Blank nodes should not be {current}.
   */
  public withAlias(previous: Id, current: Id): StructuredStore {
    if (previous === current
      || this.aliases[previous] === current
      || this.aliases[current] === previous) {
      return this;
    }

    if (this.aliases[current] !== undefined) {
      return this.withAlias(previous, this.aliases[current]);
    }

    const nextData = {
      ...this.data,
      [current]: Object
        .entries(this.data[previous] ?? {})
        .reduce((acc, [k, v]) => ({
          ...acc,
          [k]: k === idField
              ? v
              : merge(acc[k], v),
        }), this.data[current] ?? {}),
    };
    const next = this.copy(nextData);
    next.aliases[previous] = current;
    delete next.data[previous];

    // Process incoming aliases
    return Object
      .entries(this.aliases)
      .filter(([_, v]) => v === previous)
      .reduce<StructuredStore>((acc, [incoming]) => acc.withAlias(incoming, current), next);
  }

  public getRecord(recordId: Id): DataRecord | undefined {
    return this.data[this.primary(recordId)];
  }

  private copy(data: DataSlice): StructuredStore {
    const next = new StructuredStore(this.base, data);
    next.journal = this.journal.copy();
    next.aliases = JSON.parse(JSON.stringify(this.aliases));

    return next;
  }

  private initializeRecord(recordId: Id): void {
    const primary = this.primary(recordId);
    if (this.data[primary] === undefined) {
      this.journal.transition(primary, RecordState.Receiving);
      this.data[primary] = {
        _id: this.toSomeNode(primary),
      };
    }
  }

  private setRecord(recordId: Id, record: DataRecord): DataRecord | undefined {
    const primary = this.primary(recordId);
    this.journal.transition(primary, RecordState.Present);
    return this.data[primary] = record;
  }

  private toSomeNode(id: Id): SomeNode {
    if (id.includes("/")) {
      return namedNode(id);
    } else {
      return blankNode(id);
    }
  }
}
