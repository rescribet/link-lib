import DataProcessor from '../processor/DataProcessor';
import {
  DATA_ACQUIRED,
  FETCH_RESOURCE,
  FETCH_EXT,
  GET_ENTITY,
  SET_ACCEPT_HOST,
  STORE_UPDATE,
} from './messages';
import { isDifferentOrigin } from '../utilities';

export default function DataWorker({ transformers }) {
  const dataProcessor = new DataProcessor();
  self.dataProcessor = dataProcessor;

  if (Array.isArray(transformers)) {
    transformers.forEach(({ transformer, mediaTypes, acceptValue }) => {
      dataProcessor.registerTransformer(transformer, mediaTypes, acceptValue);
    });
  }

  self.addEventListener('message', ({ data, ports }) => {
    const { method, params } = data;

    if (!ports[0]) {
      return;
    }
    switch (method) {
      case DATA_ACQUIRED:
        dataProcessor
          .processExternalResponse(params.iri, data.data)
          .then((graph) => {
            ports[0].postMessage({
              method: STORE_UPDATE,
              data: graph,
            });
          });
        break;
      case FETCH_RESOURCE:
        dataProcessor
          .fetchResource(params.iri);
        break;
      case GET_ENTITY:
        if (isDifferentOrigin(params.iri.value)) {
          const accept = self.dataProcessor.accept[new URL(params.iri).origin] ||
            self.dataProcessor.accept.default;
          ports[0].postMessage({
            method: FETCH_EXT,
            data: {
              params,
              formats: accept,
            },
          });
        } else {
          dataProcessor
            .getEntity(params.iri)
            .then((graph) => {
              ports[0].postMessage({
                method: STORE_UPDATE,
                data: graph,
              });
            });
        }
        break;
      case SET_ACCEPT_HOST:
        dataProcessor.setAcceptForHost(
          params.origin,
          params.acceptValue,
        );
        break;
      default:
        throw new Error('unknown message');
    }
  }, false);
}
