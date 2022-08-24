import "./useFactory";

import "jest";
import { AttributeKey, TypedRecord } from "../TypedRecord";

describe("TypedRecord", () => {
    const keya = new AttributeKey("a");
    const keyb = new AttributeKey("b");
    const keyc = new AttributeKey("c");

    it("gets nonexisting key", () => {
        const record = new TypedRecord();

        expect(record.get(keya)).toBeUndefined();
    });

    it("gets the size", () => {
        const record = new TypedRecord();
        expect(record.size).toBe(0);

        record.set(keya, "");
        expect(record.size).toBe(1);
    });

    it("pretty prints toString", () => {
        const record = new TypedRecord();
        expect(record.size).toBe(0);

        record.set(keya, "");
        expect(record.toString()).toBe("[object Map]");
    });

    it("pretty prints AttributeKey toString", () => {
        expect(keya.toString()).toBe("a");
    });

    it("clears the map", () => {
        const record = new TypedRecord();
        expect(record.size).toBe(0);

        record.set(keya, "");
        expect(record.size).toBe(1);

        record.clear();
        expect(record.size).toBe(0);
    });

    it("deletes the key", () => {
        const record = new TypedRecord();
        expect(record.size).toBe(0);

        record.set(keya, "");
        record.set(keyb, "");
        record.set(keyc, "");
        expect(record.size).toBe(3);

        record.delete(keya);
        expect(record.size).toBe(2);
    });

    it("returns the keys", () => {
        const record = new TypedRecord();

        record.set(keya, "");
        record.set(keyb, "");
        record.set(keyc, "");
        expect(Array.from(record.keys())).toEqual([
            keya,
            keyb,
            keyc,
        ]);
    });

    it("returns the values", () => {
        const record = new TypedRecord();

        record.set(keya, "value key");
        record.set(keyb, "value keyb");
        record.set(keyc, "value keyc");
        expect(Array.from(record.values())).toEqual([
            "value key",
            "value keyb",
            "value keyc",
        ]);
    });

    it("handles forEach", () => {
        const record = new TypedRecord();

        record.set(keya, "value key");
        record.set(keyb, "value keyb");
        record.set(keyc, "value keyc");

        const processed: unknown[] = [];

        record.forEach((item) => {
            processed.push(item);
        });

        expect(processed).toEqual([
            "value key",
            "value keyb",
            "value keyc",
        ]);
    });

    it("handles entries", () => {
        const record = new TypedRecord();

        record.set(keya, "value key");
        record.set(keyb, "value keyb");
        record.set(keyc, "value keyc");

        expect(Array.from(record.entries())).toEqual([
            [keya, "value key"],
            [keyb, "value keyb"],
            [keyc, "value keyc"],
        ]);
    });

    it("handles iterators", () => {
        const record = new TypedRecord();

        record.set(keya, "value key");
        record.set(keyb, "value keyb");
        record.set(keyc, "value keyc");

        const keys = [];
        const values = [];

        for (const [key, item] of record) {
            keys.push(key);
            values.push(item);
        }

        expect(keys).toEqual([
            keya,
            keyb,
            keyc,
        ]);
        expect(values).toEqual([
            "value key",
            "value keyb",
            "value keyc",
        ]);
    });

    it("has key existence", () => {
        const record = new TypedRecord();
        expect(record.has(keya)).toBe(false);

        record.set(keya, "");
        expect(record.has(keya)).toBe(true);
    });
});
