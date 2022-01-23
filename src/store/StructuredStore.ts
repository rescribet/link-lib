import { SomeTerm } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";

import { normalizeType } from "../utilities";
import { RecordJournal } from "./RecordJournal";
import { RecordState } from "./RecordState";

export type Id = string;
export type FieldId = string;
export type MultimapTerm = SomeTerm[];
export type FieldValue = SomeTerm | MultimapTerm;
export type DataRecord = Record<FieldId, FieldValue>;

const member = rdfs.member.value;
const memberPrefix = rdf.ns("_").value;

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
  public data: Record<Id, DataRecord> = {};

  /** @private */
  public journal: RecordJournal = new RecordJournal();

  private aliases: Record<string, Id & FieldId> = {};

  constructor(base: string = "rdf:defaultGraph") {
    this.base = base;
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
    this.initializeRecord(recordId);
    this.setRecord(recordId, {
      ...this.getRecord(recordId),
      [field]: value,
    });
  }

  /** @deprecated */
  public addField(recordId: Id, field: FieldId, value: SomeTerm): void {
    this.initializeRecord(recordId);

    const existingRecord = this.getRecord(recordId);
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
      ...this.getRecord(recordId),
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

    if (current !== value && Array.isArray(current) ? !current.includes(value) : false) {
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

    const next = new StructuredStore(this.base);
    next.journal = this.journal;
    next.aliases = {
      ...this.aliases,
      [previous]: current,
    };
    next.data = {
      ...this.data,
      [current]: Object
        .entries(this.data[previous] ?? {})
        .reduce((acc, [k, v]) => ({
          ...acc,
          [k]: merge(acc[k], v),
        }), this.data[current] ?? {}),
    };
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

  private initializeRecord(recordId: Id): void {
    this.data[this.primary(recordId)] ||= {};
  }

  private setRecord(recordId: Id, record: DataRecord): DataRecord | undefined {
    return this.data[this.primary(recordId)] = record;
  }
}
