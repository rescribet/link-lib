import "../../__tests__/useFactory";

import rdf from "@ontologies/core";
import * as rdfx from "@ontologies/rdf";
import * as rdfs from "@ontologies/rdfs";

import { createStore } from "../../createStore";
import { LinkedRenderStore } from "../../LinkedRenderStore";
import { StructuredStore } from "../../store/StructuredStore";

import {
  addField,
  deleteAllFieldsMatching,
  deleteField,
  deleteFieldMatching, invalidateAllWithProperty,
  invalidateRecord,
  Messages,
  setField,
  setRecord,
} from "../message";
import { createMessageProcessor, MessageProcessor } from "../messageProcessor";

describe("messageProcessor", () => {
  const init = (): [MessageProcessor, LinkedRenderStore<unknown>, StructuredStore] => {
    const lrs = createStore();
    const process = createMessageProcessor(lrs);

    return [process, lrs, lrs.store.getInternalStore().store];
  };

  it("throws on unknown message types", () => {
    const report = jest.fn();
    const lrs = createStore({
      report,
    });
    const process = createMessageProcessor(lrs);

    expect(() => {
      process({
        type: "Unexpected",
      } as unknown as Messages);
    }).toThrow();
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("processes SetRecord", () => {
    const [process, __, store] = init();

    process(setRecord("/", {
      [rdfx.type.value]: rdfx.Seq,
    }));

    expect(store.getRecord("/")).toEqual({
      _id: rdf.namedNode("/"),
      [rdfx.type.value]: rdfx.Seq,
    });
  });

  describe("AddField", () => {
    it("processes AddField", () => {
      const [process, __, store] = init();
      store.setRecord("/", {
        [rdfx.type.value]: rdfs.Container,
      });

      process(addField("/", rdfs.label.value, rdf.literal("a")));
      expect(store.getRecord("/")).toEqual({
        _id: rdf.namedNode("/"),
        [rdfx.type.value]: rdfs.Container,
        [rdfs.label.value]: rdf.literal("a"),
      });

      process(addField("/", rdfs.label.value, rdf.literal("b")));
      expect(store.getRecord("/")).toEqual({
        _id: rdf.namedNode("/"),
        [rdfx.type.value]: rdfs.Container,
        [rdfs.label.value]: [
          rdf.literal("a"),
          rdf.literal("b"),
        ],
      });
    });

    it("allows initializing with rdf:type", () => {
      const [process, __, store] = init();

      process(addField("/", rdfx.type.value, rdfs.Resource));
      expect(store.getRecord("/")).toEqual({
        _id: rdf.namedNode("/"),
        [rdfx.type.value]: rdfs.Resource,
      });
    });

  });

  describe("SetField", () => {
    it("processes SetField", () => {
      const [process, __, store] = init();
      store.setRecord("/", {
        [rdfx.type.value]: rdfs.Resource,
      });

      process(setField("/", rdfs.label.value, rdf.literal("a")));
      expect(store.getRecord("/")).toEqual({
        _id: rdf.namedNode("/"),
        [rdfx.type.value]: rdfs.Resource,
        [rdfs.label.value]: rdf.literal("a"),
      });

      process(setField("/", rdfs.label.value, rdf.literal("b")));
      expect(store.getRecord("/")).toEqual({
        _id: rdf.namedNode("/"),
        [rdfx.type.value]: rdfs.Resource,
        [rdfs.label.value]: rdf.literal("b"),
      });
    });

    it("invalidates the record if partial", () => {
      const [process, lrs, store] = init();
      const spy = jest.spyOn(lrs, "queueEntity");
      store.setRecord("/", {
        [rdfs.label.value]: [
          rdf.literal("a"),
          rdf.literal("b"),
        ],
      });

      process(setField("/", rdfs.label.value, rdf.literal("/")));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(rdf.namedNode("/"), { reload: true });
    });

    it("allows initializing with rdf:type", () => {
      const [process, __, store] = init();

      process(setField("/", rdfx.type.value, rdfs.Resource));
      expect(store.getRecord("/")).toEqual({
        _id: rdf.namedNode("/"),
        [rdfx.type.value]: rdfs.Resource,
      });
    });
  });

  it("processes DeleteField", () => {
    const [process, __, store] = init();
    store.setRecord("/", {
      [rdfs.label.value]: [
        rdf.literal("a"),
        rdf.literal("b"),
      ],
    });

    process(deleteField("/", rdfs.label.value));
    expect(store.getRecord("/")).toEqual({
      _id: rdf.namedNode("/"),
    });
  });

  it("processes DeleteFieldMatching", () => {
    const [process, __, store] = init();
    store.setRecord("/", {
      [rdfs.label.value]: [
        rdf.literal("a"),
        rdf.literal("b"),
        rdf.literal("c"),
      ],
    });

    process(deleteFieldMatching("/", rdfs.label.value, rdf.literal("b")));
    expect(store.getRecord("/")).toEqual({
      _id: rdf.namedNode("/"),
      [rdfs.label.value]: [
        rdf.literal("a"),
        rdf.literal("c"),
      ],
    });

    process(deleteFieldMatching("/", rdfs.label.value, rdf.literal("a")));
    expect(store.getRecord("/")).toEqual({
      _id: rdf.namedNode("/"),
      [rdfs.label.value]: rdf.literal("c"),
    });
  });

  it("processes DeleteAllFieldsMatching", () => {
    const [process, __, store] = init();
    store.setRecord("/", {
      [rdfx.type.value]: rdfs.Container,
      [rdfs.label.value]: rdf.literal("a"),
    });
    store.setRecord("/b", {
      [rdfx.type.value]: rdfs.Resource,
      [rdfs.label.value]: rdf.literal("b"),
    });
    store.setRecord("/c", {
      [rdfx.type.value]: [
        rdfs.Class,
        rdfs.Resource,
      ],
      [rdfs.label.value]: rdf.literal("c"),
    });

    process(deleteAllFieldsMatching(rdfx.type.value, rdfs.Resource));

    expect(store.getRecord("/")).toEqual({
      _id: rdf.namedNode("/"),
      [rdfx.type.value]: rdfs.Container,
      [rdfs.label.value]: rdf.literal("a"),
    });
    expect(store.getRecord("/b")).toEqual({
      _id: rdf.namedNode("/b"),
      [rdfs.label.value]: rdf.literal("b"),
    });
    expect(store.getRecord("/c")).toEqual({
      _id: rdf.namedNode("/c"),
      [rdfx.type.value]: rdfs.Class,
      [rdfs.label.value]: rdf.literal("c"),
    });
  });

  it("processes InvalidateRecord", () => {
    const [process, lrs] = init();
    const spy = jest.spyOn(lrs, "queueEntity");

    process(invalidateRecord("/"));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(rdf.namedNode("/"), { reload: true });
  });

  it("processes InvalidateAllWithProperty", () => {
    const [process, lrs, store] = init();
    const spy = jest.spyOn(lrs, "queueEntity");

    store.setRecord("/", {
      [rdfx.type.value]: rdfs.Container,
      [rdfs.label.value]: rdf.literal("a"),
    });
    store.setRecord("/b", {
      [rdfx.type.value]: rdfs.Resource,
      [rdfs.label.value]: rdf.literal("b"),
    });
    store.setRecord("/c", {
      [rdfx.type.value]: [
        rdfs.Class,
        rdfs.Resource,
      ],
      [rdfs.label.value]: rdf.literal("c"),
    });

    process(invalidateAllWithProperty(rdfx.type.value, rdfs.Resource));

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(rdf.namedNode("/b"), { reload: true });
    expect(spy).toHaveBeenCalledWith(rdf.namedNode("/c"), { reload: true });
  });
});
