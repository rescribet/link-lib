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
 * @param {String} iri The original iri that was fetched.
 * @param {Response} res The (fetch) response object from the request.
 * @returns {rdf.Graph} A graph with metadata about the response.
 */
function processResponse(iri, res) {
  const graph = new rdf.Graph();
  const origin = new URL(res.url).origin;
  graph.add(
    new rdf.Quad(
      new rdf.NamedNode(res.url),
      new rdf.NamedNode(rdf.resolve('http:statusCodeValue')),
      new rdf.Literal(parseInt(res.status, 10)),
      origin,
    ),
  );
  if (iri !== res.url) {
    graph.add(
      new rdf.Quad(
        new rdf.NamedNode(iri),
        new rdf.NamedNode('http://www.w3.org/2002/07/owl#sameAs'),
        new rdf.NamedNode(res.url),
        origin,
      ),
    );
  }
  return graph;
}

const LDAPI = {
  /** @access private */
  accept: {
    default: '',
  },
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
      const accept = this.accept[new URL(iri).origin] || this.accept.default;
      if (isDifferentOrigin(iri) && ex) {
        resolve(fetchWithExtension(iri, accept));
      } else {
        resolve(fetch(iri, {
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: accept,
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
        const responseQuads = processResponse(iri, res);
        store.merge(new URL(res.url).origin, responseQuads);
        const format = getContentType(res);
        const processor = this.mapping[format][0];
        return processor(res, (graph) => {
          store.merge(new URL(res.url).origin, graph);
          return processGraph(responseQuads.merge(graph), this.output).then(next);
        });
      })
      .catch((e) => {
        if (typeof e.res === 'undefined') {
          throw e;
        }
        store.merge(new URL(e.res.url).origin, processResponse(iri, e.res));
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
      this.accept.default = [this.accept.default, [mediaType, acceptValue].join(';')].join();
    });
  },

  /**
   * Overrides the `Accept` value for when a certain host doesn't respond well to multiple values.
   * @access public
   * @param origin The iri of the origin for the requests.
   * @param acceptValue The value to use for the `Accept` header.
   */
  setAcceptForHost(origin, acceptValue) {
    this.accept[new URL(origin).origin] = acceptValue;
  },
};

export default LDAPI;
