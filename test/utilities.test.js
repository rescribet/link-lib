import 'babel-polyfill'
import assert from 'assert';
import { describe, it } from 'mocha';

import { flattenProperty, propertyIncludes } from '../src/utilities';
import schema from './fixtures/schema';

describe('utility functions are correct', function() {
  describe('flattenProperty functions correct', function() {
    const propObj = {
      '@id': 'https://schema.org/name',
    };
    const flatProp = 'https://schema.org/name';

    const propArr = [
      { "@id": "http://schema.org/Article" },
      { "@id": "http://schema.org/PublicationVolume" },
      { "@id": "http://schema.org/PublicationIssue" }
    ];
    const flatArr = [
      'http://schema.org/Article',
      'http://schema.org/PublicationVolume',
      'http://schema.org/PublicationIssue',
    ];

    it('flattens single properties', function() {
      assert(flattenProperty(propObj) === flatProp);
    });
    it('flattens an array of properties', function() {
      assert(flattenProperty(propArr).toString() === flatArr.toString());
    });
  });

  describe('propertyIncludes functions correct', function() {
    it('handles undefined objects', function() {
      assert(typeof propertyIncludes(undefined, 'schema:name') === 'undefined');
    });
    describe('propertyIncludes handles plain objects', function() {
      it('finds a plain property', function() {
        const item = schema['@graph'].find(obj => obj['@id'] === 'http://schema.org/downloadUrl');
        assert.equal(
          propertyIncludes(item['http://schema.org/domainIncludes'], 'http://schema.org/SoftwareApplication'),
          'http://schema.org/SoftwareApplication'
        );
      });
      it('finds an array on a plain property', function() {
        const item = schema['@graph'].find(obj => obj['@id'] === 'http://schema.org/downloadUrl');
        assert.equal(
          propertyIncludes(
            item['http://schema.org/domainIncludes'],
            ['http://schema.org/SoftwareApplication', 'http://schema.org/name']),
          'http://schema.org/SoftwareApplication'
        );
      });
      it('finds an array property', function() {
        const item = schema['@graph'].find(obj => obj['@id'] === 'http://schema.org/pagination');
        assert.deepEqual(
          propertyIncludes(item['http://schema.org/domainIncludes'], 'http://schema.org/Article'),
          { '@id': 'http://schema.org/Article' }
        );
      });
      it('finds an array on an array property', function() {
        const item = schema['@graph'].find(obj => obj['@id'] === 'http://schema.org/pagination');
        assert.deepEqual(
          propertyIncludes(
            item['http://schema.org/domainIncludes'],
            ['http://schema.org/SoftwareApplication', 'http://schema.org/PublicationVolume']),
          { '@id': 'http://schema.org/PublicationVolume' }
        );
      });
      it('finds multiple on an array on an array property', function() {
        const item = schema['@graph'].find(obj => obj['@id'] === 'http://schema.org/pagination');
        assert.deepEqual(
          propertyIncludes(
            item['http://schema.org/domainIncludes'],
            ['http://schema.org/SoftwareApplication',
              'http://schema.org/PublicationIssue',
              'http://schema.org/PublicationVolume']),
          { '@id': 'http://schema.org/PublicationVolume' }
        );
      });
    });
  });
});
