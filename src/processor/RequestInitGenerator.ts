export interface RequestInitGeneratorOpts {
    credentials: string;
    csrfFieldName: string;
    mode: string;
    xRequestedWith: string;
}

export class RequestInitGenerator {
    public readonly credentials: string;
    public readonly csrfFieldName: string;
    public readonly mode: string;
    public readonly xRequestedWith: string;

    constructor(opts: RequestInitGeneratorOpts = {
        credentials: "include",
        csrfFieldName: "csrf-token",
        mode: "same-origin",
        xRequestedWith: "XMLHttpRequest",
    }) {
        this.csrfFieldName = opts.csrfFieldName;
        this.credentials = opts.credentials;
        this.mode = opts.mode;
        this.xRequestedWith = opts.xRequestedWith;
    }

    public authenticityHeader(options = {}): Record<string, string> {
        return Object.assign({}, options, {
            "X-CSRF-Token": this.getAuthenticityToken(),
            "X-Requested-With": this.xRequestedWith,
        });
    }

    public generate(method = "GET", accept = "text/turtle", body?: BodyInit|null): RequestInit {
        const isFormEncoded = body instanceof URLSearchParams;
        const headers = this.authenticityHeader({ Accept: accept });
        if (isFormEncoded) {
            headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
        }

        return {
            body: isFormEncoded ? body!.toString() : body,
            credentials: "include",
            headers,
            method: method.toUpperCase(),
            mode: "same-origin",
        };
    }

    private getMetaContent(name: string): string | null {
        const header = document.head && document.head.querySelector(`meta[name="${name}"]`);
        return header && header.getAttribute("content");
    }

    private getAuthenticityToken(): string {
        return this.getMetaContent(this.csrfFieldName) || "";
    }
}
