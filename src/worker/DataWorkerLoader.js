import {
  DATA_ACQUIRED,
  FETCH_RESOURCE,
  FETCH_EXT,
  GET_ENTITY,
  SET_ACCEPT_HOST,
  STORE_UPDATE,
} from './messages';
import { fetchWithExtension } from '../utilities';

export default class DataWorkerLoader {
  constructor(WorkerModel) {
    this.worker = new WorkerModel();
    this.next = undefined;

    this.worker.onmessage = (event) => {
      const { data, method } = event.data;
      switch (method) {
        case STORE_UPDATE:
          this.next(data);
          break;
        case FETCH_EXT:
          fetchWithExtension(data.params.iri, data.formats)
            .then((response) => {
              this.worker.postMessage({
                method: DATA_ACQUIRED,
                params: data.params,
                data: response,
              });
            });
          break;
        default:
          throw new Error('Unknown message sent');
      }
      if (method === STORE_UPDATE) {
        this.next(data);
      }
    };
  }

  fetchResource(iri) {
    this.worker.postMessage({
      method: FETCH_RESOURCE,
      params: {
        iri,
      },
    });
  }

  getEntity(iri, next) {
    this.next = next;
    this.worker.postMessage({
      method: GET_ENTITY,
      params: {
        iri,
      },
    });
  }

  static registerTransformer() {
    throw new Error("Transformers should be registered directly, since they aren't cloneable nor transferable");
  }

  setAcceptForHost(origin, acceptValue) {
    this.worker.postMessage({
      method: SET_ACCEPT_HOST,
      params: {
        origin,
        acceptValue,
      },
    });
  }
}
