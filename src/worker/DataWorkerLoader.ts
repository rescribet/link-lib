import { WorkerMessageBase } from "../types";
import {
    FETCH_RESOURCE,
    GET_ENTITY,
    SET_ACCEPT_HOST,
} from "./messages";

function sendMessage(worker: Worker, message: WorkerMessageBase): Promise<object> {
    return new Promise((): void => {
        const messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = (event: MessageEvent): void => {
            if (event.data.error) {
                throw event.data.error;
            } else {
                return event.data.data;
            }
        };
        worker.postMessage(message, [messageChannel.port2]);
    });
}

export class DataWorkerLoader {
    public static registerTransformer(): void {
        throw new Error("Transformers should be registered directly, since they aren't cloneable nor transferable");
    }

    private worker: Worker;

    public constructor(worker: Worker) {
        this.worker = worker;
    }

    public fetchResource(iri: string): Promise<object> {
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

    public getEntity(iri: string): Promise<object> {
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

    public setAcceptForHost(origin: string, acceptValue: string): Promise<object> {
        return sendMessage(
            this.worker,
            {
                method: SET_ACCEPT_HOST,
                params: {
                    acceptValue,
                    origin,
                },
            },
        );
    }
}
