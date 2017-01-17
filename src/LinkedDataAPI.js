import './rdf';

import DataProcessor from './processor/DataProcessor';
// import DataWorkerLoader from './worker/DataWorkerLoader';


const LDAPI = {
  processor: new DataProcessor(),

  /**
   * Loads a resource from the {iri}.
   * @access public
   * @param iri The IRI of the resource
   * @return {Promise.<Response|object>} The response from the server, or an response object from
   * the extension
   */
  fetchResource(iri) {
    return this.processor.fetchResource(iri);
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
    this.processor.getEntity(store, iri, next);
  },

  /**
   * Register a transformer so it can be used to interact with API's.
   * @access public
   * @param {function} processor
   * @param {string|Array.<string>} mediaType
   * @param {number} acceptValue
   */
  registerTransformer(processor, mediaType, acceptValue) {
    const mediaTypes = mediaType.constructor === Array ? mediaType : [mediaType];
    this.processor.registerTransformer(processor, mediaTypes, acceptValue);
  },

  /**
   * Overrides the `Accept` value for when a certain host doesn't respond well to multiple values.
   * @access public
   * @param origin The iri of the origin for the requests.
   * @param acceptValue The value to use for the `Accept` header.
   */
  setAcceptForHost(origin, acceptValue) {
    this.processor.setAcceptForHost(origin, acceptValue);
  },
};

export default LDAPI;
