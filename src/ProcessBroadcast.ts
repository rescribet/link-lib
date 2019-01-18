import { Statement } from "rdflib";

import { SomeNode, SubscriptionRegistrationBase } from "./types";

declare global {
    interface Window {
        requestIdleCallback: (callback: any, opts: object) => number;
        cancelIdleCallback: (handle: number) => void;
    }

    interface IdleDeadline {
        timeRemaining: () => number;
        didTimeout: boolean;
    }
}

export interface ProcessBroadcastOpts {
    bulkSubscriptions: Array<SubscriptionRegistrationBase<unknown>>;
    subjectSubscriptions: Map<SomeNode, Array<SubscriptionRegistrationBase<unknown>>>;
    timeout: number;
    work: Statement[] | ReadonlyArray<Statement>;
}

/**
 * Tries to schedule updates async if possible.
 */
export class ProcessBroadcast {
    public readonly bulkLength: number;
    public readonly subjectLength: number;

    private readonly bulkSubscriptions: ReadonlyArray<SubscriptionRegistrationBase<unknown>>;
    private readonly hasIdleCallback: boolean;
    private readonly hasRequestAnimationFrame: boolean;
    private subjectSubscriptions: Map<SomeNode, Array<SubscriptionRegistrationBase<unknown>>>;
    /** Every statement to be processed. */
    private readonly work: ReadonlyArray<Statement>;
    private _subjectWork: SomeNode[] | undefined;
    private bulkLoc: number = 0;
    private resolve: () => void;
    private subjLoc: number = 0;
    private subjSubLoc: number = 0;
    private readonly timeout: number;

    constructor(opts: ProcessBroadcastOpts) {
        this.bulkSubscriptions = Object.freeze(opts.bulkSubscriptions);
        this.bulkLength = this.bulkSubscriptions.length;
        this.resolve = (): void => undefined;
        this.subjectSubscriptions = opts.subjectSubscriptions;
        this.subjectLength = this.subjectSubscriptions.size;
        this.hasIdleCallback = "requestIdleCallback" in window;
        this.hasRequestAnimationFrame = "requestAnimationFrame" in window;
        this.timeout = opts.timeout;
        this.work = Object.freeze(opts.work);
        this.queue = this.queue.bind(this);
    }

    public done(): boolean {
        if (this.work.length === 0) {
            return true;
        }
        if (this.subjectLength === 0) {
            return this.bulkLoc >= this.bulkLength;
        }
        if (this.bulkLoc < this.bulkLength) {
            return false;
        }

        const subLocItem = this.subjectSubscriptions.get(this.subjectWork[this.subjLoc]);

        return !subLocItem;
    }

    public run(): Promise <void> {
        if (this.timeout === 0) {
            this.queue();
            return Promise.resolve();
        }

        return new Promise((resolve): void => {
            this.resolve = resolve;
            this.queue();
        });
    }

    /**
     * Calls the subscriber callback function {reg} with the correct arguments according to its
     * registration settings.
     */
    private broadcast(reg: SubscriptionRegistrationBase<unknown>): void {
        if (reg.markedForDelete) {
            return;
        }
        if (reg.onlySubjects) {
            reg.callback(this.subjectWork);
        } else {
            reg.callback(this.work);
        }
    }

    private process(): void {
        if (this.bulkLoc < this.bulkLength) {
            this.processBulkItem();
        } else if (this.subjLoc < this.subjectLength) {
            this.processSubjectItem();
        }
    }

    private processBulkItem(): void {
        this.broadcast(this.bulkSubscriptions[this.bulkLoc++]);
    }

    private processSubjectItem(): void {
        const sub = this.subjectSubscriptions.get(this.subjectWork[this.subjLoc]);
        const activeSubs = sub && sub.filter((reg) => !reg.markedForDelete);
        let next;
        if (activeSubs && activeSubs.length > 0) {
            this.broadcast(activeSubs[this.subjSubLoc++]);
            next = !activeSubs[this.subjSubLoc];
        } else {
            next = true;
        }

        if (next) {
            this.subjLoc++;
            this.subjSubLoc = 0;
        }
    }

    private queue(idleCallback?: IdleDeadline | number): void {
        if (this.timeout !== 0 && this.hasIdleCallback) {
            while (typeof idleCallback === "object"
                && (!this.done() && (idleCallback.timeRemaining() > 0 || idleCallback.didTimeout))) {
                this.process();
            }

            if (this.done()) {
                return this.resolve();
            }

            window.requestIdleCallback(this.queue, {timeout: this.timeout});
        } else if (this.timeout !== 0 && this.hasRequestAnimationFrame) {
            this.process();
            while (typeof idleCallback === "number" && (performance.now() - idleCallback) < 33) {
                this.process();
            }

            if (this.done()) {
                return this.resolve();
            }

            window.requestAnimationFrame(this.queue);
        } else {
            while (!this.done()) {
                this.process();
            }

            if (this.done()) {
                this.resolve();
            }
        }
    }

    /** Every unique subject to be processed */
    private get subjectWork(): SomeNode[] {
        if (typeof this._subjectWork !== "undefined") {
            return this._subjectWork;
        }

        this._subjectWork = [];
        let s: SomeNode;
        let w: Statement|undefined;
        for (let i = 0; i < this.work.length; i++) {
            w = this.work[i];
            if (!w) { continue; }
            s = w.subject;
            if (!this._subjectWork.includes(s) && this.subjectSubscriptions.has(s)) {
                this._subjectWork.push(s);
            }
        }
        return this._subjectWork;
    }
}
