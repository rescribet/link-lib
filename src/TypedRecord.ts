
// @ts-ignore Used when looking up values.
export class AttributeKey<T> {
  private readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  public toString(): string {
    return this.key;
  }
}

// tslint:disable-next-line:max-classes-per-file
export class TypedRecord implements Map<AttributeKey<unknown>, unknown> {
  private records: Map<AttributeKey<unknown>, any> = new Map();

  public get<T>(key: AttributeKey<T>): T {
    return this.records.get(key) as unknown as T;
  }

  public get [Symbol.toStringTag](): string {
    return this.records[Symbol.toStringTag];
  }

  public get size(): number {
    return this.records.size;
  }

  public [Symbol.iterator](): IterableIterator<[AttributeKey<unknown>, unknown]> {
    return this.records[Symbol.iterator]();
  }

  public clear(): void {
    this.records.clear();
  }

  public delete(key: AttributeKey<unknown>): boolean {
    return this.records.delete(key);
  }

  public entries(): IterableIterator<[AttributeKey<unknown>, unknown]> {
    return this.records.entries() as unknown as IterableIterator<[AttributeKey<unknown>, unknown]>;
  }

  public forEach(
    callbackfn: (
      value: unknown,
      key: AttributeKey<unknown>,
      map: Map<AttributeKey<unknown>, unknown>,
    ) => void,
    thisArg?: any,
  ): void {
    return this.records.forEach(callbackfn, thisArg);
  }

  public has(key: AttributeKey<unknown>): boolean {
    return this.records.has(key);
  }

  public keys(): IterableIterator<AttributeKey<unknown>> {
    return this.records.keys();
  }

  public set<T>(key: AttributeKey<T>, value: T): this {
    this.records.set(key, value);
    return this;
  }

  public values(): IterableIterator<unknown> {
    return this.records.values();
  }
}
