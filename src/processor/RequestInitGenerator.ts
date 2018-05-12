export class RequestInitGenerator {
    public readonly credentials: string;
    public readonly csrfFieldName: string;
    public readonly mode: string;
    public readonly xRequestedWith: string;

    constructor(opts = {
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

    public authenticityHeader(options = {}): HeadersInit {
        return Object.assign({}, options, {
            "X-CSRF-Token": this.getAuthenticityToken(),
            "X-Requested-With": this.xRequestedWith,
        });
    }

    public generate(method = "GET", accept = "text/turtle"): RequestInit {
        return {
            credentials: "include",
            headers: this.authenticityHeader({
                Accept: accept,
            }),
            method: method.toUpperCase(),
            mode: "same-origin",
        };
    }

    private getMetaContent(name: string): string | null {
        const header = document.head.querySelector(`meta[name="${name}"]`);
        return header && header.getAttribute("content");
    }

    private getAuthenticityToken(): string {
        return this.getMetaContent(this.csrfFieldName) || "";
    }
}