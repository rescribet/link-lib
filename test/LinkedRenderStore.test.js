import 'babel-polyfill';
import { describe, it } from 'mocha';
import rdf from 'rdflib';

import * as ctx from './fixtures';
import { chai } from './utilities';

import LinkedRenderStore, {
  DEFAULT_TOPOLOGY,
  RENDER_CLASS_NAME,
  parseNode,
} from '../src/LinkedRenderStore';
import { defaultNS as NS } from '../src/utilities';

const { expect } = chai;
const sDT = DEFAULT_TOPOLOGY.toString();
const sRCN = RENDER_CLASS_NAME.toString();

const Thing = {
  '@id': NS.schema('Thing').value,
  '@type': NS.rdfs('Class').value,
  [NS.rdfs('comment').value]: 'The most generic type of item.',
  [NS.rdfs('label').value]: 'Thing',
};

const CreativeWork = {
  '@id': NS.schema('CreativeWork').value,
  '@type': NS.rdfs('Class').value,
  'http://purl.org/dc/terms/source': {
    '@id': 'http://www.w3.org/wiki/WebSchemas/SchemaDotOrgSources#source_rNews',
  },
  [NS.rdfs('comment').value]: 'The most generic kind of creative work, including books, movies, photographs, software programs, etc.',
  [NS.rdfs('label').value]: 'CreativeWork',
  [NS.rdfs('subClassOf').value]: {
    '@id': NS.schema('Thing').value,
  },
};

describe('LinkedRenderStore', function() {
  describe('The schema is available', function () {
    const LRS = new LinkedRenderStore();
    it('initializes the schema', function () {
      expect(LRS.schema).to.be.an('object');
      expect(LRS.schema['@graph']).to.be.an('array');
    });
  });

  describe('expands properties correctly', function() {
    const LRS = new LinkedRenderStore();
    it('expands short to long notation', function() {
      const nameShort = LRS.expandProperty('schema:name');
      expect(NS.schema('name').sameTerm(nameShort)).to.be.true;
    });

    it('preserves long notation', function() {
      const nameLong = LRS.expandProperty('http://schema.org/name');
      expect(NS.schema('name').sameTerm(nameLong)).to.be.true;
    });
  });

  describe('adds new graph items', function() {
    it('add a single graph item', function() {
      const LRS = new LinkedRenderStore();
      LRS.addOntologySchematics(Thing);
      expect(LRS.schema['@graph']).to.include(Thing);
    });

    it('adds multiple graph items', function() {
      const LRS = new LinkedRenderStore();
      LRS.addOntologySchematics([Thing, CreativeWork]);
      expect(LRS.schema['@graph']).to.include(Thing);
      expect(LRS.schema['@graph']).to.include(CreativeWork);
    });
  });

  describe('type renderer', function() {
    it('registers with shorthand', function () {
      const LRS = new LinkedRenderStore();
      const ident = a => a;
      LRS.registerRenderer(ident, NS.schema('Thing'));
      const thingComp = LRS.mapping[sRCN][NS.schema('Thing').toString()][sDT];
      expect(thingComp).to.equal(ident);
    });

    it('registers with full notation', function () {
      const LRS = new LinkedRenderStore();
      const ident = a => a;
      LRS.registerRenderer(ident, NS.schema('Thing'));
      const thingComp = LRS.mapping[sRCN][NS.schema('Thing').toString()][sDT];
      expect(thingComp).to.equal(ident);
    });

    it('registers multiple shorthand', function () {
      const ident = a => a;
      const registrations = LinkedRenderStore.registerRenderer(
        ident,
        [NS.schema('Thing'), NS.schema('CreativeWork')]
      );
      const LRS = new LinkedRenderStore();
      LRS.registerAll(registrations);
      const thingComp = LRS.mapping[sRCN][NS.schema('Thing').toString()][sDT];
      expect(thingComp).to.equal(ident);
      const cwComp = LRS.mapping[sRCN][NS.schema('CreativeWork').toString()][sDT];
      expect(cwComp).to.equal(ident);
    });
  });

  describe('property renderer', function() {
    it('registers with shorthand', function () {
      const LRS = new LinkedRenderStore();
      const ident = a => a;
      LRS.registerRenderer(ident, NS.schema('Thing'), NS.schema('name'));
      const nameComp = LRS.mapping[NS.schema('name')][NS.schema('Thing').toString()][sDT];
      expect(nameComp).to.equal(ident);
    });

    it('registers with full notation', function () {
      const LRS = new LinkedRenderStore();
      const ident = a => a;
      LRS.registerRenderer(ident, NS.schema('Thing'), NS.schema('name'));
      const nameComp = LRS.mapping[NS.schema('name')][NS.schema('Thing').toString()][sDT];
      expect(nameComp).to.equal(ident);
    });

    it('registers multiple shorthand', function () {
      const ident = a => a;
      const registrations = LinkedRenderStore.registerRenderer(
        ident,
        NS.schema('Thing'),
        [NS.schema('name'), NS.rdfs('label')],
      );
      const LRS = new LinkedRenderStore();
      LRS.registerAll(registrations);
      [NS.schema('name').toString(), NS.rdfs('label')].forEach((prop) => {
        const nameComp = LRS.mapping[prop][NS.schema('Thing').toString()][sDT];
        expect(nameComp).to.equal(ident);
        expect(nameComp).to.not.equal(b => b);
      });
    });
  });

  describe('returns renderer for', function() {
    it('class renders', function () {
      const LRS = new LinkedRenderStore();
      expect(LRS.getRenderClassForType(NS.schema('Thing'))).to.be.undefined;
      const ident = a => a;
      const registrations = LinkedRenderStore.registerRenderer(ident, NS.schema('Thing'));
      LRS.registerAll(registrations);
      const klass = LRS.getRenderClassForType(NS.schema('Thing'));
      expect(klass).to.equal(ident);
      expect(klass).to.not.equal(a => a);
    });

    it('property renders', function () {
      const LRS = new LinkedRenderStore();
      const ident = a => a;
      const registrations = LinkedRenderStore.registerRenderer(
        ident,
        NS.schema('Thing'),
        NS.schema('name')
      );
      LRS.registerAll(registrations);
      const klass = LRS.getRenderClassForProperty(NS.schema('Thing'), NS.schema('name'));
      expect(klass).to.equal(ident);
      expect(klass).to.not.equal(a => a);
    });
  });

  describe('reasons correctly', function() {
    it('combines sameAs declarations', () => {
      const opts = ctx.sameRel('sameFirst', { second: { id: 'sameSecond', title: 'other' } });
      const entity = opts.context.linkedRenderStore.tryEntity(ctx.exNS('sameFirst'));
      expect(entity.map(s => s.object.toString())).to.include('other');
    });
  });

  describe('#registerAll', function () {
    const reg1 = {
      component: () => '1',
      type: NS.schema('Thing'),
      property: NS.schema('text'),
      topology: DEFAULT_TOPOLOGY,
    };
    const reg2 = {
      component: () => '2',
      type: NS.schema('Person'),
      property: NS.schema('name'),
      topology: NS.argu('collection'),
    };

    it('stores multiple ComponentRegistration objects', function() {
      const lrs = new LinkedRenderStore();
      lrs.registerAll(reg1, reg2);
      expect(lrs.lookup(reg1.property, reg1.type, reg1.topology)).to.equal(reg1.component);
      expect(lrs.lookup(reg2.property, reg2.type, reg2.topology)).to.equal(reg2.component);
    });

    it('stores ComponentRegistration array', function() {
      const lrs = new LinkedRenderStore();
      lrs.registerAll([reg1, reg2]);
      expect(lrs.lookup(reg1.property, reg1.type, reg1.topology)).to.equal(reg1.component);
      expect(lrs.lookup(reg2.property, reg2.type, reg2.topology)).to.equal(reg2.component);
    });

    it('stores a single ComponentRegistration object', function() {
      const lrs = new LinkedRenderStore();
      lrs.registerAll(reg1);
      expect(lrs.lookup(reg1.property, reg1.type, reg1.topology)).to.equal(reg1.component);
      expect(lrs.lookup(reg2.property, reg2.type, reg2.topology)).not.to.equal(reg2.component);
    });
  });

  describe('::registerRenderer', function () {
    const func = () => {};
    const type = NS.schema('Thing');
    const types = [NS.schema('Thing'), NS.schema('Person')];
    const prop = NS.schema('name');
    const props = [NS.schema('name'), NS.schema('text'), NS.schema('dateCreated')];
    const topology = NS.argu('collection');
    const topologies = [NS.argu('collection'), NS.argu('collection')];

    function checkRegistration(r, c, t, p, top) {
      expect(r.component).to.equal(c);
      expect(r.type).to.equal(t);
      expect(r.property).to.equal(p);
      expect(r.topology).to.equal(top);
    }

    it('does not register without component', () => {
      const defaultMsg = `Undefined component was given for (${type}, ${RENDER_CLASS_NAME}, ${DEFAULT_TOPOLOGY}).`;
      try {
        LinkedRenderStore.registerRenderer(undefined, type);
        expect(true).to.be.false;
      } catch(e) {
        expect(e.message).to.equal(defaultMsg);
      }
    });

    it('registers function type', () => {
      const r = LinkedRenderStore.registerRenderer(func, type);
      expect(r.length).to.equal(1);
      checkRegistration(r[0], func, type, RENDER_CLASS_NAME, DEFAULT_TOPOLOGY);
    });

    it('registers multiple types', () => {
      const r = LinkedRenderStore.registerRenderer(func, types);
      expect(r.length).to.equal(2);
      checkRegistration(r[0], func, types[0], RENDER_CLASS_NAME, DEFAULT_TOPOLOGY);
      checkRegistration(r[1], func, types[1], RENDER_CLASS_NAME, DEFAULT_TOPOLOGY);
    });

    it('registers a prop', () => {
      const r = LinkedRenderStore.registerRenderer(func, type, prop);
      expect(r.length).to.equal(1);
      checkRegistration(r[0], func, type, prop, DEFAULT_TOPOLOGY);
    });

    it('registers mutliple props', () => {
      const r = LinkedRenderStore.registerRenderer(func, type, props);
      expect(r.length).to.equal(3);
      checkRegistration(r[0], func, type, props[0], DEFAULT_TOPOLOGY);
      checkRegistration(r[1], func, type, props[1], DEFAULT_TOPOLOGY);
      checkRegistration(r[2], func, type, props[2], DEFAULT_TOPOLOGY);
    });

    it('registers a topology', () => {
      const r = LinkedRenderStore.registerRenderer(func, type, prop, topology);
      expect(r.length).to.equal(1);
      checkRegistration(r[0], func, type, prop, topology);
    });

    it('registers multiple topologies', () => {
      const r = LinkedRenderStore.registerRenderer(func, type, prop, topologies);
      expect(r.length).to.equal(2);
      checkRegistration(r[0], func, type, prop, topologies[0]);
      checkRegistration(r[1], func, type, prop, topologies[1]);
    });

    it('registers combinations', () => {
      const r = LinkedRenderStore.registerRenderer(func, types, props, topologies);
      expect(r.length).to.equal(12);
    });
  });

  describe('parseNode', function () {
    it('parses named nodes', () => {
      const input = new rdf.NamedNode('http://example.org/p/1');
      const parsed = parseNode(Object.assign({}, input));
      expect(input.equals(parsed)).to.be.true;
      expect(parsed.constructor).to.equal(rdf.NamedNode);
    });

    it('parses blank nodes', () => {
      const input = new rdf.BlankNode();
      const parsed = parseNode(Object.assign({}, input));
      expect(input.equals(parsed)).to.be.true;
      expect(parsed.constructor).to.equal(rdf.BlankNode);
    });

    it('parses literals', () => {
      const input = new rdf.Literal();
      const parsed = parseNode(Object.assign({}, input));
      expect(input.equals(parsed)).to.be.true;
      expect(parsed.constructor).to.equal(rdf.Literal);
    });

    it('discards others', () => {
      const input = [];
      const parsed = parseNode(input);
      expect(parsed).to.be.undefined;
    });
  });
});
