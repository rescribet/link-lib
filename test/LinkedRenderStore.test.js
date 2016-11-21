import 'babel-polyfill'
import assert from 'assert';
import { describe, it } from 'mocha';

import LinkedRenderStore, { expandProperty, NSContext, schema } from '../src/LinkedRenderStore';

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
    it('has short notation keys', function() {
      assert(Object.keys(NSContext).length >= 15);
      assert(NSContext.owl === 'http://www.w3.org/2002/07/owl#');
    });
    it('initializes the schema', function () {
      assert(typeof schema === 'object');
      assert(schema['@context'] === NSContext);
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
      LinkedRenderStore.reset();
      LinkedRenderStore.addOntologySchematics(Thing);
      assert(schema['@graph'].includes(Thing));
    });
    it('adds multiple graph items', function() {
      LinkedRenderStore.reset();
      LinkedRenderStore.addOntologySchematics([Thing, CreativeWork]);
      assert(schema['@graph'].includes(Thing));
      assert(schema['@graph'].includes(CreativeWork));
    });
  });
});
