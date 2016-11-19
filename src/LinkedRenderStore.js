/* eslint no-console: 0 */
export const RENDER_CLASS_NAME = 'TYPE_RENDERER_CLASS';
const DEFAULT_TOPOLOGY = 'DEFAULT_TOPOLOGY';

export const NSContext = {
  argu: 'https://argu.co/ns/core#',
  bibo: 'http://purl.org/ontology/bibo/',
  cc: 'http://creativecommons.org/ns#',
  dbo: 'http://dbpedia.org/ontology/',
  dc: 'http://purl.org/dc/terms/',
  foaf: 'http://xmlns.com/foaf/0.1/',
  geo: 'http://www.w3.org/2003/01/geo/wgs84_pos#',
  hydra: 'http://www.w3.org/ns/hydra/core#',
  owl: 'http://www.w3.org/2002/07/owl#',
  prov: 'http://www.w3.org/ns/prov#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  schema: 'http://schema.org/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};

export const schema = {
  '@context': NSContext,
  '@graph': [],
};

const COMPACT_IRI_REGX = /^(\w+):(\w+)$/;
const CI_MATCH_LENGTH = 3;
const CI_MATCH_PREFIX = 1;
const CI_MATCH_SUFFIX = 2;

export function expandProperty(prop) {
  const matches = prop && prop.match(COMPACT_IRI_REGX);
  if (matches === null || matches === undefined || matches.length !== CI_MATCH_LENGTH) {
    return prop;
  }
  return `${NSContext[matches[CI_MATCH_PREFIX]]}${matches[CI_MATCH_SUFFIX]}`;
}

const mineForTypes = (lookupTypes, chain) => {
  if (typeof lookupTypes === 'undefined') {
    return chain;
  }
  const ont = schema['@graph'].find(e => lookupTypes.includes(e['@id']));
  if (typeof ont !== 'undefined') {
    chain.push(ont['@id']);
    const nextSuper = ont['rdfs:subClassOf'] && ont['rdfs:subClassOf']['@id'];
    return mineForTypes([nextSuper], chain);
  }
  return chain;
};

const mapping = {
  mapping: {},

  addOntologySchematics(items) {
    if (Array.isArray(items)) {
      schema['@graph'].push(...items)
    } else {
      schema['@graph'].push(items)
    }
  },

  getRenderClassForProperty(type, prop, topology = DEFAULT_TOPOLOGY) {
    const props = Array.isArray(prop) ? prop : [prop];
    const possibleClasses = this.possibleClasses(props, topology);
    if (possibleClasses.length === 0) {
      return topology === DEFAULT_TOPOLOGY ?
        undefined :
        this.getRenderClassForProperty(type, props, DEFAULT_TOPOLOGY);
    }
    for (let i = 0; props.length; i++) {
      const bestClass = this.bestClassForProp(possibleClasses, type, props);
      if (this.mapping[bestClass][props[i]][topology]) {
        return this.mapping[bestClass][props[i]][topology];
      }
    }
    return undefined;
  },

  possibleClasses(props, topology) {
    const types = Object.keys(this.mapping);
    const possibleClasses = [];
    for (let i = 0; i < types.length; i++) {
      for (let j = 0; j < props.length; j++) {
        const classType = this.mapping[types[i]][props[j]] &&
          this.mapping[types[i]][props[j]][topology];
        if (typeof classType !== 'undefined') {
          possibleClasses.push(types[i]);
        }
      }
    }
    return possibleClasses;
  },

  bestClassForProp(classes, types, prop) {
    const chain = mineForTypes(types, types || []);
    const arrPos = classes.indexOf(
      chain.find(elem => classes.indexOf(elem) >= 0)
    );
    console.log(`best class for '${types}::${prop}': '${classes[arrPos < 0 ? 0 : arrPos]}'`);
    return classes[arrPos < 0 ? 0 : arrPos];
  },

  getRenderClassForType(type, topology = DEFAULT_TOPOLOGY) {
    return this.getRenderClassForProperty(type, RENDER_CLASS_NAME, topology);
  },

  registerRenderer(component, type, property, topology = DEFAULT_TOPOLOGY) {
    if (typeof this.mapping[type] === 'undefined') {
      this.mapping[type] = {};
    }
    if (typeof this.mapping[type][RENDER_CLASS_NAME] === 'undefined') {
      this.mapping[type][RENDER_CLASS_NAME] = {};
    }

    if (typeof property !== 'undefined') {
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
  },
};

export default mapping;
