import "../../__tests__/useFactory";

import rdfFactory, { TermType } from "@ontologies/core";
import * as schema from "@ontologies/schema";

import { DataSlice } from "../DataSlice";
import { buildSlice } from "../DataSliceDSL";

describe("DataSliceDSL", () => {
  describe("id", () => {
    const expectId = (
      slice: DataSlice,
      termType: TermType,
      id: string,
    ): void => {
      const entries = Object.entries(slice);
      expect(entries).toHaveLength(1);
      const givenId = entries[0][0];
      expect(typeof givenId).toEqual("string");
      const record = entries[0][1];
      expect(record._id.termType).toEqual(termType);
      expect(record._id.value).toEqual(id);
    };

    it("raises without builder argument", () => {
      expect(() => {
        // @ts-ignore
        buildSlice();
      }).toThrow();
    });

    it("builds an empty slice", () => {
      // tslint:disable-next-line:no-empty
      expect(buildSlice(() => {})).toEqual({});
    });

    it("adds an empty record", () => {
      const slice = buildSlice((builder) => {
        builder.record();
      });

      expectId(slice, TermType.BlankNode, Object.keys(slice)[0]);
    });

    it("adds an empty record with lid", () => {
      const slice = buildSlice((builder) => {
        builder.record("_:myLocalId");
      });

      expectId(slice, TermType.BlankNode, "_:myLocalId");
    });

    it("adds an empty record with id", () => {
      const slice = buildSlice((builder) => {
        builder.record(schema.name.value);
      });

      expectId(slice, TermType.NamedNode, schema.name.value);
    });

    it("adds an empty record with term id", () => {
      const slice = buildSlice((builder) => {
        builder.record(schema.name);
      });

      expectId(slice, TermType.NamedNode, schema.name.value);
    });
  });

  describe("field", () => {
    const id = rdfFactory.blankNode();
    const target = rdfFactory.blankNode();

    it("sets a field by id", () => {
      const slice = buildSlice((builder) => {
        builder.record(id).field("myField", target);
      });

      expect(slice[id.value].myField).toEqual(target);
    });

    it("sets a field by id", () => {
      const slice = buildSlice((builder) => {
        builder.record(id).field(schema.name.value, target);
      });

      expect(slice[id.value][schema.name.value]).toEqual(target);
    });

    it("sets a field by term", () => {
      const slice = buildSlice((builder) => {
        builder.record(id).field(schema.name, target);
      });

      expect(slice[id.value][schema.name.value]).toEqual(target);
    });

    it("sets multiple fields", () => {
      const slice = buildSlice((builder) => {
        builder.record(id)
          .field(schema.name, target)
          .field(schema.text.value, rdfFactory.literal("body"));
      });

      expect(slice[id.value][schema.name.value]).toEqual(target);
      expect(slice[id.value][schema.text.value]).toEqual(rdfFactory.literal("body"));
    });

    it("allows retrieving the id", () => {
      const second = rdfFactory.blankNode();

      const slice = buildSlice((builder) => {
        const creator = builder.record(id)
          .field(schema.name, rdfFactory.literal("Bob"))
          .id();

        builder.record(second)
          .field(schema.creator, creator);
      });

      expect(slice[id.value]._id).toEqual(id);
      expect(slice[id.value][schema.name.value]).toEqual(rdfFactory.literal("Bob"));

      expect(slice[second.value]._id).toEqual(second);
      expect(slice[second.value][schema.creator.value]).toEqual(id);
    });
  });
});
