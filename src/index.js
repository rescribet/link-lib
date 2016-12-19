export * from './LinkedRenderStore';
export * from './utilities';
import { default as LinkedDataAPI } from './LinkedDataAPI';
const formats = require('rdf-formats-common')();

import jsonapi from './processors/jsonapi';
LinkedDataAPI.registerProcessor(jsonapi, 'application/vnd.api+json', 1.0);
import ntriples from './processors/ntriples';
const mediaTypes = Object.keys(formats.parsers);
const rdf = mediaTypes.splice(mediaTypes.indexOf('application/rdf+xml'), 1);
LinkedDataAPI.registerProcessor(ntriples, mediaTypes, 0.8);
if (rdf[0]) {
  LinkedDataAPI.registerProcessor(ntriples, 'application/rdf+xml', 1.0);
}
export { LinkedDataAPI };

import LinkedRenderStore from './LinkedRenderStore';
export default LinkedRenderStore;
