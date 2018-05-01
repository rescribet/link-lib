export const MSG_BAD_REQUEST = "Request failed with bad status code";
export const MSG_INCORRECT_TARGET = "Collections or Literals can't be the target";
export const MSG_URL_UNDEFINED = "No url given with action.";
export const MSG_URL_UNRESOLVABLE = "Can't execute action with non-named-node url.";
export const MSG_OBJECT_NOT_IRI = "Action object property must be an IRI.";

export class ProcessorError extends Error {
    public response?: Response;

    constructor(msg: string, response?: Response) {
        super(msg);
        this.response = response;
    }
}
