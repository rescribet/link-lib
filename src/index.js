export * from './LinkedRenderStore';
export * from './utilities';
import { default as LinkedDataAPI } from './LinkedDataAPI';
const formats = require('rdf-formats-common')();

import jsonapi from './processors/jsonapi';
LinkedDataAPI.registerProcessor(jsonapi, 'application/vnd.api+json');
import ntriples from './processors/ntriples';
LinkedDataAPI.registerProcessor(ntriples, Object.keys(formats.parsers));
export { LinkedDataAPI };

import LinkedRenderStore from './LinkedRenderStore';
export default LinkedRenderStore;
