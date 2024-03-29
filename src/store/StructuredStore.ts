import rdfFactory, { SomeTerm } from "@ontologies/core";
import * as rdf from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";

import { DataRecord, DataSlice, FieldSet, Id } from "../datastrucures/DataSlice";
import { DeepRecord, DeepRecordFieldValue } from "../datastrucures/DeepSlice";
import { FieldId, FieldValue, MultimapTerm } from "../datastrucures/Fields";
import { SomeNode } from "../types";
import { normalizeType } from "../utilities";

import { RecordJournal } from "./RecordJournal";
import { RecordState } from "./RecordState";
import { RecordStatus } from "./RecordStatus";
import { findAllReferencingIds } from "./StructuredStore/references";

export const idField = "_id";
const member = rdfs.member.value;
const memberPrefix = rdf.ns("_").value;
const namedNode = rdfFactory.namedNode.bind(rdfFactory);
const blankNode = rdfFactory.blankNode.bind(rdfFactory);

const tryParseInt = (value: string): number | string => {
  try {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? value : parsed;
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

const getSortedFieldMembers = (record: DataRecord): MultimapTerm => {
  const values: FieldValue = [];
  const sortedEntries = Object
      .entries(record)
      .sort(([k1], [k2]) => {
        const a = tryParseSeqNumber(k1);
        const b = tryParseSeqNumber(k2);

        if (typeof a !== "string" && typeof b !== "string") {
          return a - b;
        }

        if (typeof a !== "string") {
          return -1;
        }

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
  public data: DataSlice;

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
      data: DataSlice | undefined = {},
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

  public get recordCount(): number {
    return Object.keys(this.data).length;
  }

  public getStatus(recordId: Id): RecordStatus {
    return this.journal.get(this.primary(recordId));
  }

  public transition(recordId: Id, state: RecordState): void {
    this.journal.transition(recordId, state);
  }

  public touch(recordId: Id): void {
    this.journal.touch(recordId);
  }

  public deleteRecord(recordId: Id): void {
    if (this.data[recordId] === undefined) {
      if (this.journal.get(recordId).current !== RecordState.Absent) {
        this.journal.transition(recordId, RecordState.Absent);
      }
    } else {
      this.journal.transition(recordId, RecordState.Absent);
      delete this.data[recordId];
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
      [field]: (Array.isArray(value) && value.length === 1)
        ? value[0]
        : value,
    });

    return true;
  }

  /**
   * Adds a value to a field.
   * @returns Whether a mutation has occurred.
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

  public deleteFieldMatching(recordId: Id, field: FieldId, value: SomeTerm): void {
    const current = this.getField(recordId, field);
    if (current === undefined) {
      return;
    }

    if (Array.isArray(current) ? !current.includes(value) : current !== value) {
      return;
    }

    const rest = Array.isArray(current) ? current.filter((s) => s !== value) : undefined;

    if (rest !== undefined && rest.length > 0) {
      this.setField(recordId, field, rest);
    } else {
      this.deleteField(recordId, field);
    }
  }

  /**
   * Returns the [Id] which is used to store the data under.
   * @internal
   */
  public primary<T extends Id | FieldId>(id: T): T {
    return (this.aliases[id] ?? id) as T;
  }

  /**
   * Find all records which reference this given [recordId]
   */
  public references(recordId: Id): Id[] {
    return findAllReferencingIds(this.data, recordId);
  }

  /**
   * Sets the {previous} aliased to the topmost alias of {current}.
   * Aliasing only applies to record ids.
   * Any previous alias will be ignored, circular aliasing will be ignored.
   * Blank nodes should not be {current}.
   */
  public setAlias(previous: Id, current: Id): void {
    if (previous === current
      || this.aliases[previous] === current
      || this.aliases[current] === previous) {
      return;
    }

    if (this.aliases[current] !== undefined) {
      this.setAlias(previous, this.aliases[current]);
      return;
    }

    this.aliases[previous] = current;
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
    this.initializeRecord(recordId);
    this.data[recordId] = {
      ...fields,
      _id: this.data[recordId]._id,
    };
    this.journal.transition(recordId, RecordState.Present);
    return this.data[recordId];
  }

  private initializeRecord(recordId: Id): void {
    if (this.data[recordId] === undefined) {
      this.journal.transition(recordId, RecordState.Receiving);
      this.data[recordId] = {
        _id: StructuredStore.toSomeNode(recordId),
      };
    }
  }
}
