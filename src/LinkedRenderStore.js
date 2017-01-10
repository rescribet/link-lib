/* eslint no-console: 0 */
import rdf from 'rdf-ext';

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
  return `${type}[${props.join()}][${topology}]`;
}

function normalizeType(type) {
  if (!(type instanceof Array)) {
    return typeof type.toArray === 'undefined' ? [type] : type.toArray();
  }
  return type;
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
  mapping: {},

  /** @access private */
  schema: {
    '@graph': [],
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
    if (Array.isArray(items)) {
      this.schema['@graph'].push(...items);
    } else {
      this.schema['@graph'].push(items);
    }
  },

  /**
   * Expands the given types and returns the best class to render it with.
   * @param classes
   * @param {Array} [types]
   * @returns {string} The best match for the given classes and types.
   */
  bestClass(classes, types) {
    const chain = this.mineForTypes(types, types || []);
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
    const cachedGraph = this.searchStore(iri);
    if (cachedGraph && cachedGraph.length > 0) {
      return cachedGraph;
    }
    return this.api.getEntity(this.store, iri, next);
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

    try {
      const exact = this.mapping[types[0]][props[0]][topology];
      if (exact !== undefined) {
        return this.addClassToCache(exact, key);
      }
    } catch (TypeError) { /* This keeps the mapping chain code short */ }

    const possibleClasses = this.possibleClasses(props, topology);
    if (possibleClasses.length === 0) {
      return topology === DEFAULT_TOPOLOGY ?
        undefined :
        this.addClassToCache(this.getRenderClassForProperty(types, props, DEFAULT_TOPOLOGY), key);
    }
    for (let i = 0; props.length; i++) {
      const bestClass = this.bestClass(possibleClasses, types);
      const klass = this.mapping[bestClass][props[i]][topology];
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
   * @param {string[]} chain
   * @returns {string[]}
   */
  mineForTypes(lookupTypes, chain) {
    if (lookupTypes === undefined) {
      return chain;
    }
    const ont = this.schema['@graph'].find(e => lookupTypes.includes(flattenProperty(e)));
    if (ont !== undefined) {
      chain.push(flattenProperty(ont));
      const nextSuper = flattenProperty(ont['rdfs:subClassOf']);
      const sameTypes = flattenProperty(ont['owl:sameAs']);
      return this.mineForTypes([nextSuper, sameTypes], chain);
    }
    return chain;
  },

  possibleClasses(props, topology) {
    const types = Object.keys(this.mapping);
    const possibleClasses = [];
    for (let i = 0; i < types.length; i++) {
      for (let j = 0; j < props.length; j++) {
        const classType = this.mapping[types[i]][props[j]] &&
          this.mapping[types[i]][props[j]][topology];
        if (classType !== undefined) {
          possibleClasses.push(types[i]);
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
   * @param {String} [topology] An alternate topology this {component} should render.
   */
  registerRenderer(component, types, property, topology = DEFAULT_TOPOLOGY) {
    const arrTypes = types instanceof Array ? types : [types];
    arrTypes.forEach((_type) => {
      const type = this.expandProperty(_type);
      if (typeof this.mapping[type] === 'undefined') {
        this.mapping[type] = {};
      }
      if (typeof this.mapping[type][RENDER_CLASS_NAME] === 'undefined') {
        this.mapping[type][RENDER_CLASS_NAME] = {};
      }

      if (property !== undefined) {
        const arr = Array.isArray(property) ? property : [property];
        arr.forEach((p) => {
          const prop = this.expandProperty(p);
          if (typeof this.mapping[type][prop] === 'undefined') {
            this.mapping[type][prop] = {};
          }
          this.mapping[type][prop][topology] = component;
        });
      } else {
        this.mapping[type][RENDER_CLASS_NAME][topology] = component;
      }
      this.lookupCache = {};
    });
  },

  /**
   * Resets the render store mappings and the schema graph.
   * @access public
   */
  reset() {
    this.schema['@graph'] = [];
    this.mapping = [];
    this.lookupCache = {};
  },

  /**
   * Searches the store for all the triples for which {iri} is the subject.
   * @access private
   * @param {string} iri The full IRI of the resource.
   * @return {rdf.Graph|undefined}
   */
  searchStore(iri) {
    const g = this.store.graphs[new URL(iri).origin];
    if (g) {
      return g.filter(t => t.subject.equals(iri));
    }
    return undefined;
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
