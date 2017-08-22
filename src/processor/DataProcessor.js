import rdf from 'rdflib';
import { URL } from 'universal-url';

import {
  fetchWithExtension,
  getContentType,
  getExtention,
  isDifferentOrigin,
} from '../utilities';

function handleStatus(res) {
  if (res.status === 404) {
    return Promise.reject({
      res,
      message: `404: '${res.responseURL}' could not be found`,
    });
  } else if (res.status >= 400 && res.status < 500) {
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
      message: `404: '${res.responseURL}' could not be found`,
    });
  } else if (res.status >= 500) {
    return Promise.reject({
      res,
      message: 'Internal server error',
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
 * Resolves {rdf.Graph} into an array for transferring.
 * @param {rdf.Graph} graph The graph to serialize
 * @returns {Promise.<array|undefined>} The data or undefined.
 */
function processGraph(graph) {
  return Promise.resolve(graph.statements);
}

/**
 * Saves response metadata into a graph.
 * @param {String} iri The original iri that was fetched.
 * @param {Response} res The (fetch) response object from the request.
 * @returns {rdf.Graph} A graph with metadata about the response.
 */
function processResponse(iri, res) {
  const origin = new URL(res.responseURL).origin;
  const statements = [];
  if (iri !== res.responseURL) {
    statements.push(
      new rdf.Quad(
        new rdf.NamedNode(iri),
        new rdf.NamedNode('http://www.w3.org/2002/07/owl#sameAs'),
        new rdf.NamedNode(res.responseURL),
        origin,
      ),
    );
  }
  return statements;
}

export default class DataProcessor {
  constructor() {
    this.accept = {
      default: '',
    };
    this.mapping = {};
    this.requestMap = {};
    this.store = rdf.graph();
    this.fetcher = new rdf.Fetcher(this.store, 10000);
  }

  feedResponse(iri, res) {
    const format = getContentType(res);
    const processor = this.mapping[format][0];
    return processor(res);
  }

  fetchResource(iri) {
    return new Promise((resolve) => {
      const iriString = typeof iri === 'string' ? iri : iri.value;
      const accept = this.accept[new URL(iriString).origin] || this.accept.default;
      if (isDifferentOrigin(iri) && getExtention()) {
        resolve(fetchWithExtension(iri, accept));
      } else {
        if (typeof self.window === 'undefined') {
          self.window = self;
        }
        resolve(new Promise((resolveReq, rejectReq) => {
          if (accept) {
            this.fetcher.mediatypes = { [accept]: { q: 1.0 } };
          }
          this.fetcher.nowOrWhenFetched(
            iri,
            undefined,
            (ok, body, xhr) => {
              if (ok) {
                resolveReq(xhr);
              } else {
                rejectReq(xhr);
              }
            },
            {
              credentials: 'same-origin',
              headers: {
                'Content-Type': 'application/vnd.api+json',
                Accept: accept,
              },
            },
          );
        }));
      }
    })
    .then(handleStatus);
  }

  /**
   *
   * @param iri The IRI of the entity
   * @return {Promise} A promise with the resulting entity
   */
  getEntity(iri) {
    const url = new URL(iri.value);
    url.hash = '';
    const requestIRI = url.toString();
    if (typeof this.requestMap[requestIRI] !== 'undefined') {
      return Promise.reject();
    }
    const dataPromise = this
      .fetchResource(requestIRI)
      .then(res => this.feedResponse(iri, res))
      .catch((e) => {
        if (typeof e.res === 'undefined') {
          throw e;
        }
        const responseQuads = processResponse(iri, e.res);
        this.store.add(responseQuads);
        return processGraph(responseQuads, this.output);
      });
    this.requestMap[requestIRI] = dataPromise;
    return dataPromise;
  }

  processExternalResponse(iri, response) {
    return handleStatus(response)
      .then(res => this.feedResponse(undefined, res));
  }

  /**
   * Register a transformer so it can be used to interact with API's.
   * @access public
   * @param {function} transformer
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
    return this.store.match(iri, undefined, undefined, new URL(iri).origin);
  }

  setAcceptForHost(origin, acceptValue) {
    this.accept[new URL(origin).origin] = acceptValue;
  }
}
