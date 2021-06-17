export interface RequestInitGeneratorOpts {
    credentials: "include" | "same-origin" | "omit" | undefined;
    csrfFieldName: string;
    headers?: { [k: string]: string };
    mode: "same-origin" | "navigate" | "no-cors" | "cors" | undefined;
    xRequestedWith: string;
}

export class RequestInitGenerator {
    public readonly credentials: "include" | "same-origin" | "omit" | undefined;
    public readonly csrfFieldName: string;
    public readonly baseHeaders: { [k: string]: string };
    public readonly mode: "same-origin" | "navigate" | "no-cors" | "cors" | undefined;
    public readonly xRequestedWith: string;

    constructor(opts: Partial<RequestInitGeneratorOpts> = {}) {
        this.baseHeaders = opts.headers || {};
        this.csrfFieldName = opts.csrfFieldName ?? "csrf-token";
        this.credentials = opts.credentials ?? "include";
        this.mode = opts.mode ?? "same-origin";
        this.xRequestedWith = opts.xRequestedWith ?? "XMLHttpRequest";
    }

    public authenticityHeader(options = {}): Record<string, string> {
        return Object.assign({}, options, {
            "X-CSRF-Token": this.getAuthenticityToken(),
            "X-Requested-With": this.xRequestedWith,
        });
    }

    public generate(method = "GET", accept = "text/turtle", body?: BodyInit|null): RequestInit {
        const isFormEncoded = body instanceof URLSearchParams;
        const headers = this.getHeaders(accept);
        if (isFormEncoded) {
            headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
        }

        return {
            body: isFormEncoded ? body!.toString() : body,
            credentials: this.credentials,
            headers,
            method: method.toUpperCase(),
            mode: this.mode,
        };
    }

    private getHeaders(accept: string): Record<string, string> {
        const acceptHeader = Object.assign({}, this.baseHeaders, { Accept: accept });
        if (this.credentials === "include" || this.credentials === "same-origin") {
            return this.authenticityHeader(acceptHeader);
        }

        return acceptHeader;
    }

    private getMetaContent(name: string): string | null {
        const header = document.head && document.head.querySelector(`meta[name="${name}"]`);
        return header && header.getAttribute("content");
    }

    private getAuthenticityToken(): string {
        return this.getMetaContent(this.csrfFieldName) || "";
    }
}
