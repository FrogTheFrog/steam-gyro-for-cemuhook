import { IpcSender } from "../lib/ipc/ipc-sender";
import { IpcShared } from "../lib/ipc/ipc-shared";

/**
 * Event object structure for IPC method.
 */
export interface Events {
    [key: string]: [[any, any] | any, [any, any] | any];
}

/**
 * Enumeration of available methods.
 */
export const MethodEnum: [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "CONNECT",
    "OPTIONS",
    "TRACE",
    "PATCH"
] = [
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "DELETE",
        "CONNECT",
        "OPTIONS",
        "TRACE",
        "PATCH",
    ];

/**
 * Transfer status flags.
 */
export enum StatusFlag {
    CONFIRM_ID,
    ID_OK,
    DUPLICATE_ID,
    REQUEST,
    REQUEST_OK,
    RESPONSE,
    RESPONSE_OK,
    EXCEPTION,
    NOTIFICATION,
}

/**
 * Available IPC promise based methods.
 */
export type AllMethods = typeof MethodEnum[number];

/**
 * Event object structure for IPC.
 */
export type MethodicalEvents = {
    [key in AllMethods]: Events | undefined;
};

/**
 * Flips MethodicalEvents' Events types.
 */
export type flip<T extends MethodicalEvents> = {
    [method in keyof T]: T[method] extends Events ? {
        [event in keyof T[method]]: T[method][event] extends [any, any] ? [
            T[method][event][1],
            T[method][event][0]
        ] : never;
    } : never;
};

/**
 * Extract available events based on method.
 */
export type AllEvents<O extends MethodicalEvents, M extends AllMethods> =
    Extract<O[M] extends object ? keyof O[M] : never, string>;

/**
 * Extract sender type from object based on method and event.
 */
export type ExtractSenderValue<O extends MethodicalEvents, M extends AllMethods, E extends AllEvents<O, M>>
    =
    O[M] extends object ?
    O[M][E] extends [any, any] ?
    O[M][E][0] extends [any, any] ?
    O[M][E][0][0] :
    O[M][E][0] :
    never :
    never;

/**
 * Extract response type from sender type from object based on method and event.
 */
export type ExtractSenderResponseValue<O extends MethodicalEvents, M extends AllMethods, E extends AllEvents<O, M>>
    =
    O[M] extends object ?
    O[M][E] extends [any, any] ?
    O[M][E][0] extends [any, any] ?
    O[M][E][0][1] :
    O[M][E][1] extends [any, any] ?
    O[M][E][1][0] :
    O[M][E][1] :
    never :
    never;

/**
 * Extract receiver type from object based on method and event.
 */
export type ExtractReceiverValue<O extends MethodicalEvents, M extends AllMethods, E extends AllEvents<O, M>>
    =
    O[M] extends object ?
    O[M][E] extends [any, any] ?
    O[M][E][1] extends [any, any] ?
    O[M][E][1][0] :
    O[M][E][1] :
    never :
    never;

/**
 * Extract response type from receiver type from object based on method and event.
 */
export type ExtractReceiverResponseValue<O extends MethodicalEvents, M extends AllMethods, E extends AllEvents<O, M>>
    =
    O[M] extends object ?
    O[M][E] extends [any, any] ?
    O[M][E][1] extends [any, any] ?
    O[M][E][1][1] :
    O[M][E][0] extends [any, any] ?
    O[M][E][0][0] :
    O[M][E][0] :
    never :
    never;

/**
 * Transfer data type.
 */
export type TransferData<T> = [StatusFlag, UniqueID, (T | string)?];

/**
 * Callback for handling events.
 */
export type ReceiverCallback<O extends MethodicalEvents, M extends AllMethods, E extends AllEvents<O, M>>
    = (
        data: ExtractReceiverValue<O, M, E>,
        sender: IpcSender<O, SenderFunction<any>>,
        remove: ListenerRemoveCallback,
        isNotification: boolean,
    ) => Promise<ExtractReceiverResponseValue<O, M, E>> | ExtractReceiverResponseValue<O, M, E>;

/**
 * Callback for receiving notifications.
 */
export type NotificationCallback<O extends MethodicalEvents, M extends AllMethods, E extends AllEvents<O, M>>
    = (
        data: ExtractReceiverValue<O, M, E>,
        sender: IpcSender<O, SenderFunction<any>>,
        remove: ListenerRemoveCallback,
    ) => void;

/**
 * Function used for sending data via channel.
 */
export type SenderFunction<T> = (channel: string, data: TransferData<T>) => void;

/**
 * Listener event-like interface.
 */
export interface ListenerEventLike {
    sender?: {
        send: (channel: string, data: any) => void;
    };
    senderId?: number;
}

/**
 * Listener-like interface.
 */
export type SourceListenerLike = (ev: ListenerEventLike, data: any) => void;

/**
 * EventEmitter-like interface.
 */
export interface EventEmitterLike {
    on(channel: string, listener: SourceListenerLike): void;
    removeListener(channel: string, listener: SourceListenerLike): void;
}

/**
 * EventSender-like interface.
 */
export interface EventSenderLike {
    send(channel: string, data: any): void;
    sendTo(webContentsId: number, channel: string, data: any): void;
}

/**
 * Method used for sending data.
 */
export type SendMethod = EventSenderLike | SenderFunction<any>;

/**
 * Function used for handling received data.
 */
export type SourceReceiver<T> = (
    ev: ListenerEventLike,
    data: TransferData<T>,
    remove: ListenerRemoveCallback,
    notifications: ListenerCallbackData["notifications"],
) => void;

/**
 * Function used for handling received data after sending.
 */
export type SourceSender<T> = (
    ev: ListenerEventLike,
    data: TransferData<T>,
    remove: ListenerRemoveCallback,
) => void;

/**
 * Listener remove callback type.
 */
export type ListenerRemoveCallback = () => void;

/**
 * Listener callback data.
 */
export interface ListenerCallbackData {
    isListening: boolean;
    sourceCallback: SourceListenerLike;
    receiver: { callback: SourceReceiver<any>, onRemove: ListenerRemoveCallback } | null;
    senders: Map<SourceSender<any>, ListenerRemoveCallback>;
    notifications: Map<NotificationCallback<any, any, any>, ListenerRemoveCallback>;
}

/**
 * Unique id type.
 */
export type UniqueID = string | number;

/**
 * Unique id generator type.
 */
export type UniqueIDGenerator = () => UniqueID;

/**
 * Sender timeouts.
 */
export interface SenderTimeouts {
    reqTimeout?: number;
    respTimeout?: number;
}

/**
 * Sender request options.
 */
export type SenderRequestOptions<T extends SendMethod> =
    SenderTimeouts & {
        doNotEmitToListeners?: boolean;
    } & (T extends EventSenderLike ? {
        webContentsId?: number;
    } : {});

/**
 * Receiver timeouts.
 */
export interface ReceiverTimeouts {
    respTimeout?: number;
}

/**
 * Receiver request options.
 */
export interface ListenerRequestOptions<
    O extends MethodicalEvents,
    M extends AllMethods,
    E extends AllEvents<O, M>
    > extends ReceiverTimeouts {
    throwOnUserCallback?: boolean;
    errorHandler?: RequestErrorListener<O, M, E>;
    emitOnlyToErrorHandler?: boolean;
}

/**
 * Callback type used for request error listeners.
 */
export type RequestErrorListener<
    O extends MethodicalEvents,
    M extends AllMethods = AllMethods,
    E extends AllEvents<O, M> = AllEvents<O, M>
    > = (error: Error, method: M, event: E) => void;
