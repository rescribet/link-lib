import 'babel-polyfill';
import { describe, it } from 'mocha';

import * as ctx from './fixtures';
import { chai } from './utilities';

import LinkedRenderStore, { DEFAULT_TOPOLOGY, RENDER_CLASS_NAME } from '../src/LinkedRenderStore';
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
});
