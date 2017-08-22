/* eslint no-console: 0 */
import rdf from 'rdf-ext';
import DisjointSet from 'ml-disjoint-set';

import LinkDataAPI from './LinkedDataAPI';
import { flattenProperty } from './utilities';

const COMPACT_IRI_REGX = /^(\w+):(\w+)$/;
const CI_MATCH_LENGTH = 3;
const CI_MATCH_PREFIX = 1;
const CI_MATCH_SUFFIX = 2;
const DEFAULT_TOPOLOGY = 'DEFAULT_TOPOLOGY';

/**
 * Constant used to determine that a class is used to render a type rather than a property.
 * @type {string}
 */
export const RENDER_CLASS_NAME = 'TYPE_RENDERER_CLASS';

function convertToCacheKey(type, props, topology) {
  return (props.length > 1)
    ? `${type}[${props.join()}][${topology}]`
    : `${type}[${props[0]}][${topology}]`;
}

const LinkedRenderStore = {
  /** @access private */
  api: LinkDataAPI,

  /**
   * Whenever a resource has no type, assume it to be this.
   * @access public
   * @type {String|undefined} The full IRI of the type or undefined when disabled.
   */
  defaultType: 'http://schema.org/Thing',
  /**
   * @type {Object.<string, Array>}
   * @access private
   */
  lookupCache: {},

  /** @access private */
  mapping: {
    [RENDER_CLASS_NAME]: {},
  },

  /** @access private */
  schema: {
    '@graph': [],
    equivalenceSet: new DisjointSet(),
    superMap: new Map(),
  },

  /** @access private */
  store: rdf.createStore(),

  /**
   * Adds a renderer to {this.lookupCache}
   * @access private
   * @param {object|function} klass The render class.
   * @param key The memoization key.
   * @returns {Object|function} The renderer passed with {klass}
   */
  addClassToCache(klass, key) {
    this.lookupCache[key] = klass;
    return this.lookupCache[key];
  },

  /**
   * Push one or more items onto the graph so it can be used by the render store
   * for class determination.
   * @access public
   * @summary Pushes one or more item onto the graph.
   * @param items
   */
  addOntologySchematics(items) {
    const process = (item) => {
      const itemId = this.expandProperty(item['@id']);
      const sameRel = this.expandProperty(getP(item['owl:sameAs'] || item['http://www.w3.org/2002/07/owl#sameAs'], '@id'));
      if (typeof sameRel !== 'undefined' && sameRel !== null) {
        const a = this.schema.equivalenceSet.add(sameRel);
        const b = this.schema.equivalenceSet.add(itemId);
        this.schema.equivalenceSet.union(a, b);
      }
      const subClass = this.expandProperty(getP(
        item['rdfs:subClassOf'] || item['http://www.w3.org/2000/01/rdf-schema#subClassOf'],
        '@id',
      ));
      if (typeof subClass !== 'undefined' && subClass !== null) {
        if (!this.schema.superMap.has(subClass.toString())) {
          this.schema.superMap.set(subClass.toString(), new Set([subClass]));
        }
        const parents = this.schema.superMap.get(subClass.toString());
        const itemVal = this.schema.superMap.get(itemId.toString()) || new Set([itemId]);
        parents.forEach(itemVal.add, itemVal);
        this.schema.superMap.set(itemId.toString(), itemVal);
        this.schema.superMap.forEach((v, k) => {
          if (k !== itemId && v.has(itemId.toString())) {
            itemVal.forEach(v.add, v);
          }
        });
      }
    };
    if (Array.isArray(items)) {
      this.schema['@graph'].push(...items);
      items.forEach(process);
    } else {
      this.schema['@graph'].push(items);
      process(items);
    }
  },

  /**
   * Expands the given types and returns the best class to render it with.
   * @param classes
   * @param {Array} [types]
   * @returns {string} The best match for the given classes and types.
   */
  bestClass(classes, types) {
    const chain = this.mineForTypes(types).map(s => s.toString());
    const arrPos = classes.indexOf(
      chain.find(elem => classes.indexOf(elem) >= 0),
    );
    return classes[arrPos < 0 ? 0 : arrPos];
  },

  /**
   * Expands a property if it's in short-form while preserving long-form.
   * Note: The vocabulary needs to be present in the store prefix libary
   * @param {string} prop The short- or long-form property
   * @returns {string} The (expanded) property
   */
  expandProperty(prop) {
    const matches = prop && prop.match(COMPACT_IRI_REGX);
    if (matches === null || matches === undefined || matches.length !== CI_MATCH_LENGTH) {
      return prop;
    }
    return `${this.store.rdf.prefixes[matches[CI_MATCH_PREFIX]]}${matches[CI_MATCH_SUFFIX]}`;
  },

  /**
   * Resolves a renderer from the {lookupCache}.
   * @access private
   * @param key The key to look up.
   * @returns {Object|function|undefined} If saved the render class, otherwise undefined.
   */
  getClassFromCache(key) {
    return this.lookupCache[key];
  },

  /**
   * Gets an entity by its IRI.
   *
   * When data is already present for the IRI as a subject, the stored data is returned,
   * otherwise the IRI will be fetched and processed.
   * @access public
   * @param iri The IRI of the resource
   * @param next A function which handles graph updates
   */
  getEntity(iri, next) {
    this.api.getEntity(iri, next);
  },

  /**
   * Finds the best render class for a given property in respect to a topology.
   * @access public
   * @param {String|String[]} type The type(s) of the resource to render.
   * @param {String|String[]} prop The property(s) to render.
   * @param {string} [topology] The topology of the resource, if any
   * @returns {Object|function|undefined} The most appropriate renderer, if any.
   */
  getRenderClassForProperty(type = this.defaultType, prop, topology = DEFAULT_TOPOLOGY) {
    if (type === undefined) {
      return undefined;
    }
    const types = normalizeType(type);
    const props = Array.isArray(prop) ?
      prop.map(p => this.expandProperty(p)) :
      [this.expandProperty(prop)];
    const key = convertToCacheKey(types, props, topology);
    const cached = this.getClassFromCache(key);
    if (cached !== undefined) {
      return cached;
    }

    const exact = this.mapping[props[0]] &&
      this.mapping[props[0]][types[0]] &&
      this.mapping[props[0]][types[0]][topology];
    if (exact !== undefined) {
      return this.addClassToCache(exact, key);
    }

    const possibleClasses = this.possibleClasses(props, topology);
    if (possibleClasses.length === 0) {
      return topology === DEFAULT_TOPOLOGY ?
        undefined :
        this.addClassToCache(this.getRenderClassForProperty(types, props, DEFAULT_TOPOLOGY), key);
    }
    for (let i = 0; props.length; i++) {
      const bestClass = this.bestClass(possibleClasses, types);
      const klass = this.mapping[props[i]][bestClass][topology];
      if (klass) {
        return this.addClassToCache(klass, key);
      }
    }
    return undefined;
  },

  /**
   * Finds the best render class for a type in respect to a topology.
   * @see {getRenderClassForProperty}
   * @param {String|String[]} type The type(s) of the resource to render.
   * @param {string} [topology] The topology of the resource, if any
   * @returns {*|Object|Function|undefined} The most appropriate renderer, if any.
   */
  getRenderClassForType(type, topology = DEFAULT_TOPOLOGY) {
    return this.getRenderClassForProperty(type, RENDER_CLASS_NAME, topology);
  },

  /**
   * Expands the given lookupTypes to include all their equivalent and subclasses.
   * This is done in multiple iterations until no new types are found.
   * @param {string[]} lookupTypes The types to look up.
   * @returns {string[]}
   */
  mineForTypes(lookupTypes) {
    if (lookupTypes === undefined) {
      return [];
    }

    return lookupTypes.map(v => this.store.canon(v)).reduce((a, b) => {
      const superSet = this.schema.superMap.get(b.toString());
      return typeof superSet === 'undefined' ? a : a.concat(...superSet);
    }, lookupTypes);
  },

  normalizeType(type) {
    return Array.isArray(type) ? type : [type];
  },

  possibleClasses(props, topology) {
    const possibleClasses = [];
    for (let i = 0; i < props.length; i++) {
      if (typeof this.mapping[props[i]] !== 'undefined') {
        const types = Object.keys(this.mapping[props[i]]);
        for (let j = 0; j < types.length; j++) {
          const classType = this.mapping[props[i]][types[j]] &&
            this.mapping[props[i]][types[j]][topology];
          if (classType !== undefined) {
            possibleClasses.push(types[j]);
          }
        }
      }
    }
    return possibleClasses;
  },

  /**
   * Register a renderer for a type/property.
   * @access public
   * @param {Object|function} component The class to return for the rendering of the object.
   * @param {String|String[]} types The type's (compact) IRI of the object which the {component} can
   * render.
   * @param {String|String[]} [property] The property's (compact) IRI if the {component} is a
   * subject renderer.
   * @param {String} [_topology] An alternate topology this {component} should render.
   */
  registerRenderer(component, types, property = RENDER_CLASS_NAME, _topology = DEFAULT_TOPOLOGY) {
    const topology = hasP(_topology, 'value') ? _topology : this.expandProperty(_topology);
    const arrTypes = types instanceof Array ? types : [types];
    arrTypes.forEach((_type) => {
      const exType = this.expandProperty(_type);
      const type = this.schema.equivalenceSet.find(this.schema.equivalenceSet.add(exType)).value;

      const aProp = Array.isArray(property)
        ? property.map(p => this.expandProperty(p))
        : [this.expandProperty(property)];
      aProp.forEach((p) => {
        if (typeof this.mapping[p] === 'undefined') this.mapping[p] = {};
        if (typeof this.mapping[p][type] === 'undefined') this.mapping[p][type] = {};
        this.mapping[p][type][topology] = component;
      });
      this.lookupCache = {};
    });
  },

  /**
   * Resets the render store mappings and the schema graph.
   * @access public
   */
  reset() {
    this.schema = {
      '@graph': [],
      superMap: new Map(),
      equivalenceSet: new DisjointSet(),
    };
    this.mapping = {
      [RENDER_CLASS_NAME]: {},
    };
    this.lookupCache = {};
  },

  /**
   * Returns an entity from the cache directly.
   * This won't cause any network requests even if the entity can't be found.
   * @param {string} iri The IRI of the resource.
   * @param next
   * @returns {Object|undefined} The object if found, or undefined.
   */
  tryEntity(iri, next) {
    const origin = new URL(iri).origin;
    try {
      // TODO: replace with proper API to replace the _gpso call
      /* eslint no-underscore-dangle: 0 */
      return next(this.store.graphs[origin]._gspo[origin][iri]);
    } catch (TypeError) {
      return next;
    }
  },
};

LinkedRenderStore.store.rdf.prefixes.addAll({
  argu: 'https://argu.co/ns/core#',
  bibo: 'http://purl.org/ontology/bibo/',
  cc: 'http://creativecommons.org/ns#',
  dbo: 'http://dbpedia.org/ontology/',
  dc: 'http://purl.org/dc/terms/',
  dbpedia: 'http://dbpedia.org/resource/',
  foaf: 'http://xmlns.com/foaf/0.1/',
  geo: 'http://www.w3.org/2003/01/geo/wgs84_pos#',
  http: 'http://www.w3.org/2011/http#',
  hydra: 'http://www.w3.org/ns/hydra/core#',
  p: 'http://www.wikidata.org/prop/',
  prov: 'http://www.w3.org/ns/prov#',
  schema: 'http://schema.org/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  wdata: 'https://www.wikidata.org/wiki/Special:EntityData/',
  wd: 'http://www.wikidata.org/entity/',
  wds: 'http://www.wikidata.org/entity/statement/',
  wdref: 'http://www.wikidata.org/reference/',
  wdv: 'http://www.wikidata.org/value/',
  wdt: 'http://www.wikidata.org/prop/direct/',
});

export default LinkedRenderStore;
