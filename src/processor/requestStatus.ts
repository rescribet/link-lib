import { NON_AUTHORITATIVE_INFORMATION } from "http-status-codes";

import {
    FulfilledRequestStatus,
    PendingRequestStatus,
    SomeRequestStatus,
} from "../types";

/**
 * The client (User Agent) has closed the connection, e.g. due to CORS or going offline.
 */
export const failedRequest = (): FulfilledRequestStatus => Object.freeze({
    lastRequested: new Date(),
    requested: true,
    status: 499,
    timesRequested: 0,
}) as FulfilledRequestStatus;

export const timedOutRequest = (totalRequested: number): FulfilledRequestStatus => Object.freeze({
    lastRequested: new Date(),
    requested: true,
    status: 408,
    timesRequested: totalRequested,
}) as FulfilledRequestStatus;

export const queuedDeltaStatus = (totalRequested: number): FulfilledRequestStatus => Object.freeze({
    lastRequested: new Date(),
    requested: true,
    status: NON_AUTHORITATIVE_INFORMATION,
    timesRequested: totalRequested,
}) as FulfilledRequestStatus;

export function isPending(status: SomeRequestStatus): status is PendingRequestStatus {
    return status.status === null && status.requested;
}
