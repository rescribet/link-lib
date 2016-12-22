import 'whatwg-fetch';
import rdf from 'rdf-ext';
import './rdf';

import {
  F_GRAPH,
  F_JSONLD,
  fetchWithExtension,
  getContentType,
  getExtention,
  isDifferentOrigin,
} from './utilities';
const formats = require('rdf-formats-common')();

/**
 * Pushes in-place value {v} onto an array under key {k} of Map {map}.
 * @param {object|Map} map The reference to the Map to add the data to.
 * @param {string} k The key on {map}. An array is initialized when it doesn't yet exists.
 * @param {object} v
 */
function pushToMap(map, k, v) {
  if (typeof map[k] === 'undefined') {
    /* eslint no-param-reassign: 0 */
    map[k] = [];
  }
  map[k].push(v);
}

/**
 * Serializes an {rdf.Graph} into a specified output format.
 * @param {rdf.Graph} graph The graph to serialize
 * @param {string} output The media type of the output format, which has to have been registered
 * first with {registerProcessor}.
 * @returns {Promise.<string|undefined>} The serialized data or undefined.
 */
function processGraph(graph, output) {
  if (output === F_GRAPH) {
    return Promise.resolve(graph);
  }
  return formats
    .serializers[output]
    .serialize(graph)
    .then(data => data);
}

/**
 * Saves response metadata into a graph.
 * @param {Response} res The (fetch) response object from the request.
 * @returns {rdf.Graph} A graph with metadata about the response.
 */
function processResponse(res) {
  const graph = new rdf.Graph();
  const trip = new rdf.Triple(
    new rdf.NamedNode(res.url),
    new rdf.NamedNode(rdf.resolve('http:statusCodeValue')),
    new rdf.Literal(parseInt(res.status, 10)),
    new URL(res.url).origin,
  );
  graph.add(trip);
  return graph;
}

const LDAPI = {
  /** @access private */
  accept: '',
  /** Set to an IRI to add it as the type for resources which have none */
  defaultType: 'http://schema.org/Thing',
  /** @access private */
  mapping: {},
  /** Set the appropriate media-type as the output for the data calls */
  output: F_JSONLD,

  /**
   * Loads a resource from the {iri}.
   * @access public
   * @param iri The IRI of the resource
   * @return {Promise.<Response|object>} The response from the server, or an response object from
   * the extension
   */
  fetchResource(iri) {
    return new Promise((resolve) => {
      const ex = getExtention();
      if (isDifferentOrigin(iri) && ex) {
        resolve(fetchWithExtension(iri, this.accept));
      } else {
        resolve(fetch(iri, {
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: this.accept,
          },
        }));
      }
    })
    .then((res) => {
      if (res.status === 404) {
        return Promise.reject({
          res,
          message: `404: '${res.url}' could not be found`,
        });
      } else if (res.status >= 400 && res.headers.get('Content-Type').includes('json')) {
        return res
          .json()
          .then(body => Promise.reject({
            res,
            message: body.errors && body.errors[0] && body.errors[0].message,
          }));
      }
      return res;
    });
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
  getEntity(store, iri, next) {
    return this.fetchResource(iri)
      .then((res) => {
        store.merge(new URL(res.url).origin, processResponse(res));
        const format = getContentType(res);
        const processor = this.mapping[format][0];
        return processor(res, (graph) => {
          if (this.defaultType && graph.find(iri, 'rdfs:type') === undefined) {
            graph.add(new rdf.Triple(
              new rdf.NamedNode(iri),
              new rdf.NamedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
              new rdf.NamedNode(this.defaultType),
            ));
          }
          store.merge(new URL(res.url).origin, graph);
          return processGraph(graph, this.output).then(next);
        });
      })
      .catch((e) => {
        if (typeof e.res === 'undefined') {
          throw e;
        }
        store.merge(new URL(e.res.url).origin, processResponse(e.res));
      });
  },

  /**
   * Register a processor so it can be used to interact with API's.
   * @access public
   * @param {function} processor
   * @param {string|Array.<string>} mediaTypes
   * @param {number} acceptValue
   */
  registerProcessor(processor, mediaTypes, acceptValue) {
    const types = mediaTypes.constructor === Array ? mediaTypes : [mediaTypes];
    types.forEach((mediaType) => {
      pushToMap(this.mapping, mediaType, processor);
      this.accept = [this.accept, [mediaType, acceptValue].join(';')].join();
    });
  },
};

export default LDAPI;
