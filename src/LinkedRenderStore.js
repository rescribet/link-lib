/* eslint no-console: 0 */
import rdf from 'rdflib';

import LinkDataAPI from './LinkedDataAPI';
import { defaultNS, getP, hasP } from './utilities';

const DisjointSet = require('ml-disjoint-set');

const CI_MATCH_PREFIX = 0;
const CI_MATCH_SUFFIX = 1;

export const DEFAULT_TOPOLOGY = defaultNS.ll('defaultTopology');

/**
 * Constant used to determine that a class is used to render a type rather than a property.
 * @type {rdf.NamedNode}
 */
export const RENDER_CLASS_NAME = defaultNS.ll('typeRenderClass');

function convertToCacheKey(type, props, topology) {
  return (props.length > 1)
    ? `${type}[${props.join()}][${topology}]`
    : `${type}[${props[0]}][${topology}]`;
}

class LinkedRenderStore {
  constructor(opts = {}) {
    /** @access private */
    this.store = opts.store || rdf.graph();
    /** @access private */
    this.api = opts.api || new LinkDataAPI({ dataProcessorOpts: { store: this.store } });
    /**
     * Whenever a resource has no type, assume it to be this.
     * @access public
     * @type {rdf.NamedNode|undefined} The full IRI of the type or undefined when disabled.
     */
    this.defaultType = opts.defaultType || defaultNS.schema('Thing');
    /**
     * @type {Object.<string, Array>}
     * @access private
     */
    this.lookupCache = opts.lookupCache || {};
    this.namespaces = opts.namespaces || Object.assign({}, defaultNS);
    /** @access private */
    this.mapping = opts.mapping || {
      [RENDER_CLASS_NAME]: {},
    };

    /** @access private */
    this.schema = opts.schema || {
      '@graph': [],
      equivalenceSet: new DisjointSet(),
      superMap: new Map(),
    };
    this.subscriptions = [];
  }

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
  }

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
  }

  /**
   * RDF-like object for passing constructorless data.
   * @typedef {Object} RDFIsh
   * @property {('NamedNode'|'Literal')} termType The type of the statement.
   * @property {string} value The value of the statement.
   * @property {string} language The language of the literal contents.
   * @property {object} datatype The datatype of the literal.
   */

  /**
   * A singular registration object. Use a separate object for each variant.
   * @typedef {Object} ComponentRegistration
   * @property {function} component The render component.
   * @property {rdf.NamedNode} type The IRI of the type which the {component} can render.
   * @property {rdf.NamedNode} property The IRI of the property which the {component} can render.
   * @property {rdf.NamedNode} topology The IRI of the topology which the {component} can render.
   */

  /**
   * Add triple-formed data to the store
   * @access private
   * @param data [Array<RDFIsh>] Data to parse and add to the store.
   * @returns {Promise}
   */
  addStatements(data) {
    function parseNode(n) {
      if (typeof n === 'undefined') return undefined;
      switch (n.termType) {
        case 'NamedNode':
          return new rdf.NamedNode(n.value);
        case 'BlankNode':
          return new rdf.BlankNode(n.value);
        case 'Literal':
          return new rdf.Literal(n.value, n.language, parseNode(n.datatype));
        default:
          return undefined;
      }
    }

    return new Promise((resolve) => {
      let statements;
      if (data[0] && data[0].constructor !== rdf.Statement) {
        statements = data.map(s =>
          new rdf.Statement(
            parseNode(s.subject),
            parseNode(s.predicate),
            parseNode(s.object),
            undefined, // parseNode(s.why),
          ),
        );
      } else if (data && data[0].constructor === rdf.Statement) {
        statements = data;
      }
      if (Array.isArray(statements)) {
        this.store.add(statements);
        this.broadcast(statements);
      }
      resolve();
    });
  }

  /**
   * Expands the given types and returns the best class to render it with.
   * @param classes
   * @param {Array} [types]
   * @returns {rdf.NamedNode|undefined} The best match for the given classes and types.
   */
  bestClass(classes, types) {
    const chain = this.mineForTypes(types);
    return classes.find(c => chain.find(elem => c.sameTerm(elem)));
  }

  /**
   * Broadcasts statements to all subscribers.
   * @param statements {rdf.Statement[]} Array of changed data.
   */
  broadcast(statements) {
    const subjects = statements.map(s => s.subject);
    this.subscriptions.forEach(([subscriber, opts]) => {
      if (opts.onlySubjects) {
        subscriber(subjects);
      } else {
        subscriber(statements);
      }
    });
  }

  /**
   * Expands a property if it's in short-form while preserving long-form.
   * Note: The vocabulary needs to be present in the store prefix library
   * @param {string|rdf.NamedNode|undefined} prop The short- or long-form property
   * @param {Object} namespaces Object of namespaces by their abbreviation.
   * @returns {rdf.NamedNode|undefined} The (expanded) property
   */
  static expandProperty(prop, namespaces = undefined) {
    if (typeof prop === 'undefined' || typeof prop.termType !== 'undefined') {
      return prop;
    }

    if (prop.indexOf('/') >= 1) {
      return new rdf.NamedNode(prop);
    }
    const matches = prop.split(':');
    return namespaces[matches[CI_MATCH_PREFIX]](matches[CI_MATCH_SUFFIX]);
  }

  /**
   * @see {LinkedRenderStore.expandProperty}
   */
  expandProperty(prop) {
    return this.constructor.expandProperty(prop, this.namespaces);
  }

  /**
   * Resolves a renderer from the {lookupCache}.
   * @access private
   * @param key The key to look up.
   * @returns {Object|function|undefined} If saved the render class, otherwise undefined.
   */
  getClassFromCache(key) {
    return this.lookupCache[key];
  }

  /**
   * Gets an entity by its IRI.
   *
   * When data is already present for the IRI as a subject, the stored data is returned,
   * otherwise the IRI will be fetched and processed.
   * @access public
   * @param iri The IRI of the resource
   * @return {Promise} A promise with the resulting entity
   */
  getEntity(iri, onlySubjects = false) {
    const cachedEntity = this.searchStore(iri);
    if (typeof cachedEntity !== 'undefined' && cachedEntity.length > 0) {
      return Promise.resolve(cachedEntity);
    }

    return this.api.getEntity(iri)
      .then((data) => {
        this.addStatements(data);
        if (onlySubjects) {
          return data.map(s => s.subject);
        }
        return this.store.subjectIndex[this.store.canon(iri)];
      });
  }

  /**
   * Finds the best render class for a given property in respect to a topology.
   * @access public
   * @param {rdf.NamedNode|rdf.NamedNode[]} type The type(s) of the resource to render.
   * @param {rdf.NamedNode|rdf.NamedNode[]} prop The property(s) to render.
   * @param {rdf.NamedNode} [_topology] The topology of the resource, if any
   * @returns {Object|function|undefined} The most appropriate renderer, if any.
   */
  getRenderClassForProperty(type = this.defaultType, prop, _topology = DEFAULT_TOPOLOGY) {
    if (type === undefined) {
      return undefined;
    }
    const topology = hasP(_topology, 'value') ? _topology : this.expandProperty(_topology);
    const types = this.constructor.normalizeType(type);
    const props = Array.isArray(prop) ?
      prop.map(p => this.expandProperty(p)) :
      [this.expandProperty(prop)];
    const key = convertToCacheKey(types, props, topology);
    const cached = this.getClassFromCache(key);
    if (cached !== undefined) {
      return cached;
    }

    for (let i = 0; i < types.length; i++) {
      const exact = this.lookup(props[0], types[i], topology);
      if (exact !== undefined) {
        return this.addClassToCache(exact, key);
      }
    }

    const possibleClasses = this.possibleClasses(props, topology);
    if (possibleClasses.length === 0) {
      return topology === DEFAULT_TOPOLOGY ?
        undefined :
        this.addClassToCache(this.getRenderClassForProperty(types, props, DEFAULT_TOPOLOGY), key);
    }
    for (let i = 0; i < props.length; i++) {
      const bestClass = this.bestClass(possibleClasses, types);
      const klass = this.lookup(props[i], bestClass, topology);
      if (klass) {
        return this.addClassToCache(klass, key);
      }
    }
    for (let i = 0; i < props.length; i++) {
      const klass = this.lookup(props[i], this.defaultType, topology);
      if (klass) {
        return this.addClassToCache(klass, key);
      }
    }
    return undefined;
  }

  /**
   * Finds the best render class for a type in respect to a topology.
   * @see {getRenderClassForProperty}
   * @param {rdf.NamedNode|rdf.NamedNode[]} type The type(s) of the resource to render.
   * @param {rdf.NamedNode} [topology] The topology of the resource, if any
   * @returns {*|Object|Function|undefined} The most appropriate renderer, if any.
   */
  getRenderClassForType(type, topology = DEFAULT_TOPOLOGY) {
    return this.getRenderClassForProperty(type, RENDER_CLASS_NAME, topology);
  }

  /**
   * Find a class from the mapping.
   * @access private
   * @param {rdf.NamedNode} prop The IRI of the property (or {RENDER_CLASS_NAME})
   * @param {rdf.NamedNode} type The IRI of the resource type
   * @param {rdf.NamedNode} topology The IRI of the topology
   * @returns {function|undefined} The appropriate class if any
   */
  lookup(prop, type, topology) {
    if (!this.mapping[prop] || !this.mapping[prop][type]) {
      return undefined;
    }
    return this.mapping[prop][type][topology];
  }

  /**
   * Expands the given lookupTypes to include all their equivalent and subclasses.
   * This is done in multiple iterations until no new types are found.
   * @param {string[]} lookupTypes The types to look up.
   * @returns {string[]}
   */
  mineForTypes(lookupTypes) {
    const types = lookupTypes !== undefined ? lookupTypes : [];

    return types.map(v => this.store.canon(v)).reduce((a, b) => {
      const superSet = this.schema.superMap.get(b.toString());
      return typeof superSet === 'undefined' ? a : a.concat(...superSet);
    }, types);
  }

  static normalizeType(type) {
    return Array.isArray(type) ? type : [type];
  }

  possibleClasses(props, topology) {
    const possibleClasses = [this.namespaces.rdfs('Resource')];
    for (let i = 0; i < props.length; i++) {
      if (typeof this.mapping[props[i]] !== 'undefined') {
        const types = Object.keys(this.mapping[props[i]]);
        for (let j = 0; j < types.length; j++) {
          const classType = this.lookup(props[i], types[j], topology);
          if (classType !== undefined) {
            possibleClasses.push(new rdf.NamedNode(types[j].slice(1, -1)));
          }
        }
      }
    }
    return possibleClasses;
  }

  /**
   * Removes an array of statements and inserts another.
   * Note: Be sure that the replacement contains the same subjects as the original to let the
   *  broadcast work correctly.
   * @param original The statements to remove from the store.
   * @param replacement The statements to add to the store.
   */
  replaceStatements(original, replacement) {
    const uniqueStatements = replacement
      .filter(s => !original.some(
        o => o.subject.sameTerm(s.subject) && o.predicate.sameTerm(s.predicate),
      ));

    // FIXME: There seems to be a bug in rdf which doesn't remove all statements on the try,
    //         but an additional call to `remove` seems to do the job.
    this
      .store
      .remove(original)
      .remove(original);
    // Remove statements not in the old object. Useful for replacing data loosely related to the
    //  main resource.
    uniqueStatements.forEach(s => this.store.removeMatches(s.subject, s.predicate));
    this.addStatements(replacement);
  }

  /**
   * Listen for data changes by subscribing to store changes.
   * @param callback {function} Will be called with the new statements as its argument.
   * @param opts {object} Options for the callback.
   * @param opts.onlySubjects {boolean} Only the subjects are passed when true.
   */
  subscribe(callback, opts) {
    this.subscriptions.push([callback, opts]);
  }

  /**
   * Generate registration description objects for later registration use.
   * @see {LinkedRenderStore#registerAll}
   * @access public
   * @param {function|function[]} component
   * @param {rdf.NamedNode|rdf.NamedNode[]} type
   * @param {rdf.NamedNode|rdf.NamedNode[]} prop
   * @param {rdf.NamedNode|rdf.NamedNode[]} topology
   * @return {ComponentRegistration[]}
   */
  static registerRenderer(component, type, prop = RENDER_CLASS_NAME, topology = DEFAULT_TOPOLOGY) {
    if (typeof component === 'undefined') {
      throw new Error(`Undefined component was given for (${type}, ${prop}, ${topology}).`);
    }
    const types = type instanceof Array ? type : [type];
    const properties = Array.isArray(prop)
      ? prop.map(p => this.expandProperty(p))
      : [this.expandProperty(prop)];
    const topologies = Array.isArray(topology)
      ? topology.map(t => this.expandProperty(t || DEFAULT_TOPOLOGY))
      : [this.expandProperty(topology || DEFAULT_TOPOLOGY)];

    const registrations = [];

    types.forEach((t) => {
      properties.forEach((p) => {
        topologies.forEach((top) => {
          registrations.push({
            component,
            type: t,
            property: p,
            topology: top,
          });
        });
      });
    });

    return registrations;
  }

  /**
   * Register a renderer for a type/property.
   * @access public
   * @param {Object|function} component The class to return for the rendering of the object.
   * @param {rdf.NamedNode} type The type's IRI of the object which the {component} can render.
   * @param {rdf.NamedNode} [property] The property's IRI if the {component} is a subject renderer.
   * @param {rdf.NamedNode} [topology] An alternate topology this {component} should render.
   */
  registerRenderer(component, type, property = RENDER_CLASS_NAME, topology = DEFAULT_TOPOLOGY) {
    if (!property || !type) {
      return;
    }
    if (typeof this.mapping[property] === 'undefined') this.mapping[property] = {};
    if (typeof this.mapping[property][type] === 'undefined') this.mapping[property][type] = {};
    this.mapping[property][type][topology] = component;
    this.lookupCache = {};
  }

  /**
   * Bulk register components formatted with {LinkedRenderStore.registerRenderer}.
   * @access public
   * @param {ComponentRegistration[][]|ComponentRegistration[]} components
   * @see {LinkedRenderStore.registerRenderer}
   */
  registerAll(...components) {
    components.forEach((c) => {
      if (Array.isArray(c)) {
        c.forEach(i => this.registerRenderer(i.component, i.type, i.property, i.topology));
      } else {
        this.registerRenderer(c.component, c.type, c.property, c.topology);
      }
    });
  }

  /**
   * Resets the render store mappings and the schema graph.
   * @access public
   */
  reset() {
    this.store = rdf.graph();
    this.schema = {
      '@graph': [],
      superMap: new Map(),
      equivalenceSet: new DisjointSet(),
    };
    this.mapping = {
      [RENDER_CLASS_NAME]: {},
    };
    this.lookupCache = {};
  }

  /**
   * Returns an entity from the cache directly.
   * This won't cause any network requests even if the entity can't be found.
   * @param {string} iri The IRI of the resource.
   * @returns {Object|undefined} The object if found, or undefined.
   */
  tryEntity(iri) {
    return this.searchStore(iri);
  }

  /**
   * Searches the store for all the triples for which {iri} is the subject.
   * @access private
   * @param {string} iri The full IRI of the resource.
   * @return {Object|undefined}
   */
  searchStore(iri) {
    const canon = this.store.canon(iri);
    return typeof this.store.subjectIndex[canon] !== 'undefined'
      ? this.store.subjectIndex[canon]
      : undefined;
  }
}

export default LinkedRenderStore;
