import { Hextuple, Resource } from "@ontologies/core";

import { SubscriptionRegistrationBase } from "./types";

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
    /** Ids of the subjects which have been changed in this batch */
    changedSubjects: string[];
    /**
     * Subject registrations to call
     * It is assumed to only contain subscriptions relevant to the {work}.
     */
    subjectSubscriptions: Array<SubscriptionRegistrationBase<unknown>>;
    timeout: number;
    /** Statements which have changed in the store */
    work: Hextuple[] | ReadonlyArray<Hextuple>;
}

/**
 * Tries to schedule updates async if possible.
 */
export class ProcessBroadcast {
    private readonly bulkSubscriptions: Array<SubscriptionRegistrationBase<unknown>>;
    private readonly changedSubjects: Resource[];
    private readonly hasIdleCallback: boolean;
    private readonly hasRequestAnimationFrame: boolean;
    private readonly regUpdateTime: number;
    private subjectSubscriptions: Array<SubscriptionRegistrationBase<unknown>>;
    private readonly work: ReadonlyArray<Hextuple>;
    private resolve: () => void;
    private readonly timeout: number;

    constructor(opts: ProcessBroadcastOpts) {
        this.hasIdleCallback = "requestIdleCallback" in window;
        this.hasRequestAnimationFrame = "requestAnimationFrame" in window;
        this.resolve = (): void => undefined;
        this.timeout = opts.timeout;
        this.regUpdateTime = Date.now();

        this.bulkSubscriptions = opts.bulkSubscriptions;
        this.changedSubjects = opts.changedSubjects;
        this.subjectSubscriptions = opts.subjectSubscriptions;
        this.work = Object.freeze(opts.work);

        this.queue = this.queue.bind(this);
    }

    public done(): boolean {
        return this.work.length === 0
            || this.subjectSubscriptions.length === 0 && this.bulkSubscriptions.length === 0;
    }

    public run(): Promise<void> {
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
    private callSubscriber(reg: SubscriptionRegistrationBase<unknown>): void {
        if (reg.markedForDelete) {
            return;
        }
        reg.callback(
            reg.onlySubjects ? this.changedSubjects : this.work,
            this.regUpdateTime,
        );
    }

    private process(): void {
        if (this.bulkSubscriptions.length > 0) {
            this.callSubscriber(this.bulkSubscriptions.pop()!);
        } else if (this.subjectSubscriptions.length > 0) {
            this.callSubscriber(this.subjectSubscriptions.pop()!);
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

            this.resolve();
        }
    }
}
