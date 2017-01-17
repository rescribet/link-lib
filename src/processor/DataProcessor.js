import rdf from 'rdf-ext';

import {
  F_GRAPH,
  F_JSONLD,
  fetchWithExtension,
  getContentType,
  getExtention,
  isDifferentOrigin,
} from '../utilities';

const formats = require('rdf-formats-common')();

function handleStatus(res) {
  if (res.status === 404) {
    return Promise.reject({
      res,
      message: `404: '${res.url}' could not be found`,
    });
  } else if (res.status >= 400) {
    if ((res.headers['Content-Type'] || res.headers.get('Content-Type')).includes('json')) {
      return res
      .json()
      .then(body => Promise.reject({
        res,
        message: body.errors && body.errors[0] && body.errors[0].message,
      }));
    }
    return Promise.reject({
      res,
      message: `404: '${res.url}' could not be found`,
    });
  }
  return Promise.resolve(res);
}

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
    .then(data => JSON.parse(data));
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

export default class DataProcessor {
  constructor() {
    this.accept = {
      default: '',
    };
    this.mapping = {};
    /** Set the appropriate media-type as the output for the data calls */
    this.output = F_JSONLD;
    this.store = rdf.createStore();
  }

  feedResponse(iri, res, next) {
    const responseQuads = processResponse(iri, res);
    this.store.merge(new URL(res.url).origin, responseQuads);
    const format = getContentType(res);
    const processor = this.mapping[format][0];
    return processor(res, (graph) => {
      this.store.merge(new URL(res.url).origin, graph);
      return processGraph(responseQuads.merge(graph), this.output).then(next);
    });
  }

  fetchResource(iri) {
    return new Promise((resolve) => {
      const accept = this.accept[new URL(iri).origin] || this.accept.default;
      if (isDifferentOrigin(iri) && getExtention()) {
        resolve(fetchWithExtension(iri, accept));
      } else {
        resolve(self.fetch(iri, {
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Accept: accept,
          },
        }));
      }
    })
    .then(handleStatus);
  }

  getEntity(iri, next) {
    const cachedGraph = this.searchStore(iri);
    if (cachedGraph && cachedGraph.length > 0) {
      processGraph(cachedGraph, this.output).then(next);
    }
    this.fetchResource(iri)
      .then(res => this.feedResponse(iri, res, next))
      .catch((e) => {
        if (typeof e.res === 'undefined') {
          throw e;
        }
        const responseQuads = processResponse(iri, e.res);
        this.store.merge(new URL(e.res.url).origin, responseQuads);
        processGraph(responseQuads, this.output).then(next);
      });
  }

  processExternalResponse(iri, response, next) {
    handleStatus(response)
      .then(res => this.feedResponse(undefined, res, next));
  }

  /**
   * Register a transformer so it can be used to interact with API's.
   * @access public
   * @param {function} processor
   * @param {String|Array.<String>} mediaType
   * @param {number} acceptValue
   */
  registerTransformer(transformer, mediaType, acceptValue) {
    const mediaTypes = mediaType.constructor === Array ? mediaType : [mediaType];
    mediaTypes.forEach((type) => {
      pushToMap(this.mapping, type, transformer);
      this.accept.default = [this.accept.default, [type, acceptValue].join(';')].join();
    });
  }

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
  }

  setAcceptForHost(origin, acceptValue) {
    this.accept[new URL(origin).origin] = acceptValue;
  }
}
