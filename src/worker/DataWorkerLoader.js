import {
  FETCH_RESOURCE,
  GET_ENTITY,
  SET_ACCEPT_HOST,
} from './messages';

function sendMessage(worker, message) {
  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data.data);
      }
    };
    worker.postMessage(message, [messageChannel.port2]);
  });
}

export default class DataWorkerLoader {
  constructor(WorkerModel) {
    this.worker = new WorkerModel();
  }

  fetchResource(iri) {
    return sendMessage(
      this.worker,
      {
        method: FETCH_RESOURCE,
        params: {
          iri,
        },
      },
    );
  }

  getEntity(iri) {
    return sendMessage(
      this.worker,
      {
        method: GET_ENTITY,
        params: {
          iri,
        },
      },
    );
  }

  static registerTransformer() {
    throw new Error("Transformers should be registered directly, since they aren't cloneable nor transferable");
  }

  setAcceptForHost(origin, acceptValue) {
    sendMessage(
      this.worker,
      {
        method: SET_ACCEPT_HOST,
        params: {
          origin,
          acceptValue,
        },
      },
    );
  }
}
