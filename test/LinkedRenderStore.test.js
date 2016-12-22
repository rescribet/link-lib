import 'babel-polyfill';
import assert from 'assert';
import { describe, it } from 'mocha';

import LRS, { expandProperty, RENDER_CLASS_NAME } from '../src/LinkedRenderStore';
const schema = LRS.schema;

const Thing = {
  '@id': 'http://schema.org/Thing',
  '@type': 'rdfs:Class',
  'rdfs:comment': 'The most generic type of item.',
  'rdfs:label': 'Thing',
};

const CreativeWork = {
  '@id': 'http://schema.org/CreativeWork',
  '@type': 'rdfs:Class',
  'http://purl.org/dc/terms/source': {
    '@id': 'http://www.w3.org/wiki/WebSchemas/SchemaDotOrgSources#source_rNews',
  },
  'rdfs:comment': 'The most generic kind of creative work, including books, movies, photographs, software programs, etc.',
  'rdfs:label': 'CreativeWork',
  'rdfs:subClassOf': {
    '@id': 'http://schema.org/Thing',
  },
};


describe('LinkedRenderStore functions well', function() {
  describe('The schema is available', function () {
    it('initializes the schema', function () {
      assert(typeof schema === 'object');
      assert(Array.isArray(schema['@graph']));
    });
  });

  describe('expands properties correctly', function() {
    it('expands short to long notation', function() {
      assert(expandProperty('schema:name') === 'http://schema.org/name');
    });

    it('preserves long notation', function() {
      assert(expandProperty('http://schema.org/name') === 'http://schema.org/name');
    });
  });

  describe('adds new graph items', function() {
    it('add a single graph item', function() {
      LRS.reset();
      LRS.addOntologySchematics(Thing);
      assert(schema['@graph'].includes(Thing));
    });

    it('adds multiple graph items', function() {
      LRS.reset();
      LRS.addOntologySchematics([Thing, CreativeWork]);
      assert(schema['@graph'].includes(Thing));
      assert(schema['@graph'].includes(CreativeWork));
    });
  });

  describe('type renderer', function() {
    it('registers with shorthand', function () {
      LRS.reset();
      const ident = a => a;
      LRS.registerRenderer(ident, 'schema:Thing');
      assert.equal(
        LRS.mapping['http://schema.org/Thing'][RENDER_CLASS_NAME]['DEFAULT_TOPOLOGY'],
        ident
      );
    });

    it('registers with full notation', function () {
      LRS.reset();
      const ident = a => a;
      LRS.registerRenderer(ident, 'http://schema.org/Thing');
      assert.equal(
        LRS.mapping['http://schema.org/Thing'][RENDER_CLASS_NAME]['DEFAULT_TOPOLOGY'],
        ident
      );
    });

    it('registers multiple shorthand', function () {
      LRS.reset();
      const ident = a => a;
      LRS.registerRenderer(ident, ['schema:Thing', 'schema:CreativeWork']);
      assert.equal(
        LRS.mapping['http://schema.org/Thing'][RENDER_CLASS_NAME]['DEFAULT_TOPOLOGY'],
        ident
      );
      assert.equal(
        LRS.mapping['http://schema.org/CreativeWork'][RENDER_CLASS_NAME]['DEFAULT_TOPOLOGY'],
        ident
      );
    });
  });

  describe('property renderer', function() {
    it('registers with shorthand', function () {
      LRS.reset();
      const ident = a => a;
      LRS.registerRenderer(ident, 'schema:Thing', 'schema:name');
      assert.equal(
        LRS.mapping['http://schema.org/Thing']['http://schema.org/name']['DEFAULT_TOPOLOGY'],
        ident
      );
    });

    it('registers with full notation', function () {
      LRS.reset();
      const ident = a => a;
      LRS.registerRenderer(ident, 'http://schema.org/Thing', 'http://schema.org/name');
      assert.equal(
        LRS.mapping['http://schema.org/Thing']['http://schema.org/name']['DEFAULT_TOPOLOGY'],
        ident
      );
    });

    it('registers multiple shorthand', function () {
      LRS.reset();
      const ident = a => a;
      LRS.registerRenderer(
        ident,
        'schema:Thing',
        ['schema:name', 'rdfs:label']
      );
      ['http://schema.org/name', 'http://www.w3.org/2000/01/rdf-schema#label'].map(prop => {
        assert.equal(
          LRS.mapping['http://schema.org/Thing'][prop]['DEFAULT_TOPOLOGY'],
          ident
        );
        assert.notEqual(
          LRS.mapping['http://schema.org/Thing'][prop]['DEFAULT_TOPOLOGY'],
          b => b
        );
      });
    });
  });

  describe('returns renderer for', function() {
    it('class renders', function () {
      LRS.reset();
      const ident = a => a;
      LRS.registerRenderer(ident, 'http://schema.org/Thing');
      assert.equal(LRS.getRenderClassForType('http://schema.org/Thing'), ident);
      assert.notEqual(LRS.getRenderClassForType('http://schema.org/Thing'), a => a);
    });

    it('property renders', function () {
      LRS.reset();
      const ident = a => a;
      LRS.registerRenderer(ident, 'http://schema.org/Thing', 'http://schema.org/name');
      assert.equal(LRS.getRenderClassForProperty('http://schema.org/Thing', 'schema:name'), ident);
      assert.notEqual(
        LRS.getRenderClassForProperty('http://schema.org/Thing', 'schema:name'),
        a => a
      );
    });
  });
});
