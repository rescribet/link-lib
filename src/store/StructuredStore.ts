import rdfFactory, { SomeTerm } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";

import { SomeNode } from "../types";
import { normalizeType } from "../utilities";
import { RecordJournal } from "./RecordJournal";
import { RecordState } from "./RecordState";
import { RecordStatus } from "./RecordStatus";
import {
  DataRecord,
  DataSlice,
  DeepRecord,
  DeepRecordFieldValue,
  FieldId,
  FieldSet,
  FieldValue,
  Id,
  MultimapTerm,
} from "./types";

export const idField = "_id";
const member = rdfs.member.value;
const memberPrefix = rdf.ns("_").value;
const namedNode = rdfFactory.namedNode.bind(rdfFactory);
const blankNode = rdfFactory.blankNode.bind(rdfFactory);

const tryParseInt = (value: string): number | string => {
  try {
    return parseInt(value, 10);
  } catch (e) {
    return value;
  }
};

const tryParseSeqNumber = (value: string): number | string => {
  const ordinal = value.split(memberPrefix).pop();

  if (ordinal !== undefined) {
    return tryParseInt(ordinal);
  } else {
    return value;
  }
};

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
        const a = tryParseSeqNumber(k1);
        const b = tryParseSeqNumber(k2);

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

  private static toSomeNode(id: Id): SomeNode {
    if (id.indexOf("_:") === 0) {
      return blankNode(id);
    } else {
      return namedNode(id);
    }
  }
  /**
   * The base URI of the data.
   */
  public base: string;

  /** @private */
  public data: Record<Id, DataRecord>;

  /** @private */
  public journal: RecordJournal;

  private aliases: Record<string, Id & FieldId> = {};

  /**
   *
   * @param base
   * @param data Will be modified, so don't re-use the reference elsewhere.
   * @param onChange @internal
   */
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
    if (this.data[primary] === undefined) {
      if (this.journal.get(primary).current !== RecordState.Absent) {
        this.journal.transition(primary, RecordState.Absent);
      }
    } else {
      this.journal.transition(primary, RecordState.Absent);
      delete this.data[primary];
    }
  }

  public getField(recordId: Id, field: FieldId): FieldValue | undefined {
    if (field === member) {
      const record = this.getRecord(recordId);
      if (record === undefined) {
        return undefined;
      }

      return getSortedFieldMembers(record);
    } else {
      return this.getRecord(recordId)?.[field];
    }
  }

  /**
   * @returns Whether a mutation has occurred.
   */
  public setField(recordId: Id, field: FieldId, value: FieldValue): boolean {
    if (field === idField) {
      throw new Error("Can't set system fields");
    }
    this.initializeRecord(recordId);
    const current = this.getRecord(recordId)!;

    if (current[field] === value) {
      return false;
    }

    this.setRecord(recordId, {
      ...current,
      [field]: value,
    });

    return true;
  }

  /**
   * @returns Whether a mutation has occurred.
   * @deprecated
   */
  public addField(recordId: Id, field: FieldId, value: SomeTerm): boolean {
    if (field === idField) {
      throw new Error("Can't set system fields");
    }
    this.initializeRecord(recordId);

    const existingRecord = this.getRecord(recordId)!;
    const existingValue = existingRecord?.[field];
    const existingIsArray = Array.isArray(existingValue);
    const valueAlreadyPresent = existingIsArray
        ? existingValue.includes(value)
        : existingValue !== undefined && existingValue === value;

    if (valueAlreadyPresent) {
      return false;
    }

    const combined = existingIsArray
      ? [...existingValue, value]
      : existingValue
            ? [existingValue, value]
            : value;

    this.setRecord(recordId, {
      ...existingRecord,
      [field]: combined,
    });

    return true;
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

  public allRecords(): DataRecord[] {
    return Object.values(this.data);
  }

  public getRecord(recordId: Id): DataRecord | undefined {
    return this.data[this.primary(recordId)];
  }

  public collectRecord(recordId: Id, collected: Id[] = []): DeepRecord | undefined {
    const record = this.getRecord(recordId);

    if (!record) { return undefined; }

    const unpack = (v: SomeTerm): FieldValue | DeepRecord => {
      if (v.termType !== "BlankNode" || collected.includes(v.value)) {
        return v;
      }

      return this.collectRecord(v.value, [v.value, ...collected]) ?? v;
    };

    return Object.entries(record).reduce(
      (acc: DeepRecord, [k, v]) => ({
        [k]: (Array.isArray(v) ? v.map(unpack) : unpack(v)) as DeepRecordFieldValue,
        ...acc,
      }),
      { _id: record._id } as DataRecord,
    );
  }

  public setRecord(recordId: Id, fields: FieldSet): DataRecord | undefined {
    const primary = this.primary(recordId);
    this.initializeRecord(recordId);
    this.data[primary] = {
      ...fields,
      _id: this.data[primary]._id,
    };
    this.journal.transition(primary, RecordState.Present);
    return this.data[primary];
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
        _id: StructuredStore.toSomeNode(primary),
      };
    }
  }
}
