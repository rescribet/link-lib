export interface Value {
  type: "id" | "lid" | "p" | "s" | "dt" | "b" | "i" | "l" | "ls";
  v: string;
}

export interface GlobalId extends Value {
  type: "id";
  v: string;
}

export interface LocalId extends Value {
  type: "lid";
  v: string;
}

export interface Primitive extends Value {
  type: "p";
  v: string;
  dt: string;
}

export interface EmpString extends Value {
  type: "s";
  v: string;
}

export interface EmpBoolean extends Value {
  type: "b";
  v: string;
}

export interface Int extends Value {
  type: "i";
  v: string;
}

export interface Long extends Value {
  type: "l";
  v: string;
}

export interface DateTime extends Value {
  type: "dt";
  v: string;
}

export interface LangString extends Value {
  type: "ls";
  v: string;
  l: string;
}

export interface Identifiable {
  _id: GlobalId | LocalId;
}

export type Fields = Record<string, Value | Value[]>;

export type SliceDataRecord = Identifiable & Fields;

export type Slice = Record<string, SliceDataRecord>;

export type DeepSliceFieldValue = Value | Value[] | DeepSliceDataRecord | DeepSliceDataRecord[];

export interface DeepSliceFields {
  [field: string]: DeepSliceFieldValue;
}

export type DeepSliceDataRecord = Identifiable & DeepSliceFields;

export type DeepSlice = Record<string, DeepSliceDataRecord>;
