/* eslint no-console: 0 */
import rdf from 'rdf-ext';

import { flattenProperty } from './utilities';

/**
 * Constant used to determine that a class is used to render a type rather than a property.
 * @type {string}
 */
export const RENDER_CLASS_NAME = 'TYPE_RENDERER_CLASS';

const DEFAULT_TOPOLOGY = 'DEFAULT_TOPOLOGY';

rdf.prefixes.addAll({
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
export const NSContext = rdf.prefixes;

const COMPACT_IRI_REGX = /^(\w+):(\w+)$/;
const CI_MATCH_LENGTH = 3;
const CI_MATCH_PREFIX = 1;
const CI_MATCH_SUFFIX = 2;

/**
 * Expands a property if it's in short-form while preserving long-form.
 * Note: The vocabulary needs to be present in NSContext
 * @param {string} prop The short- or long-form property
 * @returns {string} The (expanded) property
 */
export function expandProperty(prop) {
  const matches = prop && prop.match(COMPACT_IRI_REGX);
  if (matches === null || matches === undefined || matches.length !== CI_MATCH_LENGTH) {
    return prop;
  }
  return `${NSContext[matches[CI_MATCH_PREFIX]]}${matches[CI_MATCH_SUFFIX]}`;
}

function convertToCacheKey(type, props, topology) {
  return `${type}[${props.join()}][${topology}]`;
}

const LinkedRenderStore = {
  /** @access private */
  mapping: {},

  /**
   * @type {Object.<string, Array>}
   * @access private
   */
  lookupCache: {},

  /** @access private */
  schema: {
    '@context': NSContext,
    '@graph': [],
  },

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

  bestClass(classes, types) {
    const chain = this.mineForTypes(types, types || []);
    const arrPos = classes.indexOf(
      chain.find(elem => classes.indexOf(elem) >= 0),
    );
    return classes[arrPos < 0 ? 0 : arrPos];
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
   *
   * @access public
   * @param type
   * @param prop
   * @param topology
   * @returns {*}
   */
  getRenderClassForProperty(type, prop, topology = DEFAULT_TOPOLOGY) {
    if (type === undefined) {
      return undefined;
    }
    const props = Array.isArray(prop) ? prop : [prop];
    const key = convertToCacheKey(type, props, topology);
    const cached = this.getClassFromCache(key);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const exact = this.mapping[type[0]][props[0]][topology];
      if (exact !== undefined) {
        return this.addClassToCache(exact, key);
      }
    } catch (TypeError) { /* This keeps the mapping chain code short */ }

    const possibleClasses = this.possibleClasses(props, topology);
    if (possibleClasses.length === 0) {
      return topology === DEFAULT_TOPOLOGY ?
        undefined :
        this.getRenderClassForProperty(type, props, DEFAULT_TOPOLOGY);
    }
    for (let i = 0; props.length; i++) {
      const bestClass = this.bestClass(possibleClasses, type);
      const klass = this.mapping[bestClass][props[i]][topology];
      if (klass) {
        return this.addClassToCache(klass, key);
      }
    }
    return undefined;
  },

  getRenderClassForType(type, topology = DEFAULT_TOPOLOGY) {
    return this.getRenderClassForProperty(type, RENDER_CLASS_NAME, topology);
  },

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
   * @param {String} types The type's (compact) IRI of the object which the {component} can render.
   * @param {String} [property] The property's (compact) IRI if the {component} is a subject
   *                            renderer.
   * @param {String} [topology] An alternate topology this {component} should render.
   */
  registerRenderer(component, types, property, topology = DEFAULT_TOPOLOGY) {
    const arrTypes = types instanceof Array ? types : [types];
    arrTypes.forEach((_type) => {
      const type = expandProperty(_type);
      console.debug(`Registering renderer ${component.name} for ${type}/${property}::${topology}`);
      if (typeof this.mapping[type] === 'undefined') {
        this.mapping[type] = {};
      }
      if (typeof this.mapping[type][RENDER_CLASS_NAME] === 'undefined') {
        this.mapping[type][RENDER_CLASS_NAME] = {};
      }

      if (property !== undefined) {
        const arr = Array.isArray(property) ? property : [property];
        arr.forEach((p) => {
          const prop = expandProperty(p);
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
    this.schema['@context'] = NSContext;
    this.schema['@graph'] = [];
    this.mapping = [];
    this.lookupCache = {};
  },
};

export default LinkedRenderStore;
