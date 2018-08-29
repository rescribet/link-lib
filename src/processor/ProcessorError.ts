export class ProcessorError extends Error {
    public response?: Response;

    constructor(msg: string, response?: Response) {
        super(msg);
        this.response = response;
    }
}
