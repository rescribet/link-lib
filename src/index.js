import LinkedRenderStore from './LinkedRenderStore';
import jsonapi from './processors/jsonapi';
import rdfFormatsCommon from './processors/rdf-formats-common';

export * from './LinkedRenderStore';
export * from './utilities';
export const processors = {
  jsonapi,
  rdfFormatsCommon,
};
export default LinkedRenderStore;
