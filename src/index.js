import LinkedDataAPI from './LinkedDataAPI';
import LinkedRenderStore from './LinkedRenderStore';
import jsonapi from './processors/jsonapi';
import ntriples from './processors/ntriples';

const formats = require('rdf-formats-common')();

LinkedDataAPI.registerProcessor(jsonapi, 'application/vnd.api+json', 1.0);
const mediaTypes = Object.keys(formats.parsers);
const rdf = mediaTypes.splice(mediaTypes.indexOf('application/rdf+xml'), 1);
LinkedDataAPI.registerProcessor(ntriples, mediaTypes, 0.8);
if (rdf[0]) {
  LinkedDataAPI.registerProcessor(ntriples, 'application/rdf+xml', 1.0);
}

export * from './LinkedRenderStore';
export * from './utilities';
export { LinkedDataAPI };
export default LinkedRenderStore;
