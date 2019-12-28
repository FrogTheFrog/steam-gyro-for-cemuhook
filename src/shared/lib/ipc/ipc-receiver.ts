import {
    AllEvents as Events,
    AllMethods as Methods,
    EventSenderLike,
    ExtractReceiverResponseValue as ReceiverResponse,
    ExtractReceiverValue as ReceiverValue,
    ExtractSenderValue as SenderValue,
    ListenerEventLike,
    ListenerRemoveCallback,
    ListenerRequestOptions as Options,
    MethodicalEvents,
    NotificationCallback,
    ReceiverCallback as Callback,
    ReceiverTimeouts,
    RequestErrorListener,
    SenderFunction,
    SourceReceiver,
    StatusFlag,
    UniqueID,
} from "../../models/ipc.models";
import { privateData } from "../private-data";
import { IpcSender } from "./ipc-sender";
import { IpcShared } from "./ipc-shared";

/**
 * Internal data for `IpcReceiver`.
 */
interface InternalData {
    ownedReceivers: Set<string>;
    ownedNotifications: Set<NotificationCallback<any, any, any>>;
    shared: IpcShared;
    sendMethod?: EventSenderLike;
}

/**
 * Internal data accessor for `IpcReceiver`.
 */
const getInternals = privateData() as
    <O extends MethodicalEvents>(self: IpcReceiver<O>, init: InternalData | void) => InternalData;

/**
 * Symbol for separating uncaught error from intentional error to keep promise flow going.
 */
const errorWasThrown = Symbol("Error thrown in user's callback in IpcListener");

/**
 * Generates send function for `IpcReceiver`.
 * @param ev Event object.
 * @param sendMethod Optional send method object for renderer process.
 */
function generateSendFn<
    O extends MethodicalEvents,
    M extends Methods,
    E extends Events<O, M>
>(
    ev: ListenerEventLike,
    sendMethod?: EventSenderLike,
): SenderFunction<SenderValue<O, M, E> | ReceiverResponse<O, M, E>> {
    if (typeof sendMethod === "object") {
        const id = ev.senderId;
        if (typeof id === "number") {
            const isDestroyed = () =>  typeof sendMethod.isDestroyed === "function" ? sendMethod.isDestroyed() : false;
            if (id === 0) {
                return (channel, data) => {
                    if (!isDestroyed()){
                        sendMethod.send(channel, data);
                    }
                };
            } else {
                return (channel, data) => {
                    if (!isDestroyed()){
                        sendMethod.sendTo(id, channel, data);
                    }
                };
            }
        } else {
            throw new TypeError("Event does not contain \"senderId\".");
        }
    } else {
        const sender = ev.sender;
        if (sender !== undefined && typeof sender.send === "function") {
            const isDestroyed = () =>  typeof sender.isDestroyed === "function" ? sender.isDestroyed() : false;
            return (channel, data) => {
                if (!isDestroyed()){
                    sender.send(channel, data);
                }
            };
        } else {
            throw new TypeError(`Event does not contain \"${sender ? "sender" : "sender.send"}\".`);
        }
    }
}

/**
 * IPC wrapper for receiving data.
 */
export class IpcReceiver<O extends MethodicalEvents> {
    /**
     * Global response timeout value (allowed time it takes to receive `RESPONSE_OK` from sender).
     */
    public respTimeout: number;

    /**
     * A set of error callbacks to be called on error.
     */
    public onError: Set<RequestErrorListener<O>> = new Set();

    /**
     * @param shared Shared data manager.
     * @param sendMethod Optional send method (required for renderer process).
     * @param timeouts Optional timeout object for setting global timeouts.
     */
    constructor(shared: IpcShared, sendMethod?: EventSenderLike, timeouts?: ReceiverTimeouts) {
        const { respTimeout = 10000 } = timeouts || {};

        this.respTimeout = respTimeout;
        getInternals(this, {
            ownedNotifications: new Set(),
            ownedReceivers: new Set(),
            sendMethod,
            shared,
        });
    }

    /**
     * Add received data handler.
     * @param method Method to handle.
     * @param event Event to handle.
     * @param callback Callback respond with. If a notification was received, user data will not be send as a response.
     * @param options Custom data handler options.
     */
    public on<M extends Methods, E extends Events<O, M>>(
        method: M,
        event: E,
        callback: Callback<O, M, E>,
        options?: Options<O, M, E>,
    ) {
        const pd = getInternals(this);
        const {
            respTimeout = this.respTimeout,
            throwOnUserCallback = false,
            emitOnlyToErrorHandler = false,
            errorHandler = null,
        } = options || {};

        const channel = pd.shared.generateChannel(method, event);
        const takenIds = new Set<UniqueID>();
        const timeouts = new Map<UniqueID, NodeJS.Timeout>();

        const removeId = (id: UniqueID) => {
            pd.shared.id.remove(id);
            takenIds.delete(id);
        };
        const emitError = (error: Error) => {
            if (emitOnlyToErrorHandler && typeof errorHandler === "function") {
                errorHandler(error, method, event);
            } else {
                if (typeof errorHandler === "function") {
                    errorHandler(error, method, event);
                }
                for (const errorCallback of this.onError) {
                    errorCallback(error, method, event as unknown as Events<O, Methods>);
                }
            }
        };

        const listener: SourceReceiver<ReceiverValue<O, M, E>> = (ev, transferData, remove, notifications) => {
            try {
                const [tStatus, tId, tData = void 0] = transferData;

                switch (tStatus) {
                    case StatusFlag.CONFIRM_ID: {
                        const send = generateSendFn<O, M, E>(ev, pd.sendMethod);

                        if (pd.shared.id.add(tId)) {
                            takenIds.add(tId);
                            send(channel, [StatusFlag.ID_OK, tId]);
                        } else {
                            send(channel, [StatusFlag.DUPLICATE_ID, tId]);
                        }
                        break;
                    }
                    case StatusFlag.REQUEST: {
                        const send = generateSendFn<O, M, E>(ev, pd.sendMethod);
                        const sender = new IpcSender<O, typeof send>(pd.shared, send);

                        send(channel, [StatusFlag.REQUEST_OK, tId]);

                        Promise.resolve(callback(tData as ReceiverValue<O, M, E>, sender, remove, false))
                            .catch((error) => {
                                send(channel, [StatusFlag.EXCEPTION, tId, error.message || error]);
                                removeId(tId);
                                if (throwOnUserCallback) {
                                    throw error;
                                }
                                else {
                                    emitError(error);
                                }
                                return errorWasThrown;
                            }).then((dataToSend) => {
                                if (dataToSend !== errorWasThrown) {
                                    send(channel, [StatusFlag.RESPONSE, tId, dataToSend as ReceiverResponse<O, M, E>]);

                                    timeouts.set(tId, setTimeout(() => {
                                        emitError(new Error(`${channel}: Response did not reach target.`));
                                        removeId(tId);
                                        timeouts.delete(tId);
                                    }, respTimeout));
                                }
                            }).catch((error) => {
                                remove();
                                emitError(error);
                            });

                        for (const [notify] of notifications) {
                            (notify as NotificationCallback<O, M, E>)(
                                tData as ReceiverValue<O, M, E>,
                                sender,
                                () => pd.shared.listener.removeNotification(channel, notify),
                            );
                        }

                        break;
                    }
                    case StatusFlag.RESPONSE_OK: {
                        const timeout = timeouts.get(tId);
                        if (timeout) {
                            clearTimeout(timeout);
                            removeId(tId);
                            timeouts.delete(tId);
                        } else {
                            throw new Error(`${channel}: OK status received for id (${tId}) with no timeout.`);
                        }
                        break;
                    }
                    case StatusFlag.NOTIFICATION: {
                        const send = generateSendFn<O, M, E>(ev, pd.sendMethod);
                        const sender = new IpcSender<O, typeof send>(pd.shared, send);

                        Promise.resolve(callback(tData as ReceiverValue<O, M, E>, sender, remove, true))
                            .catch(emitError);

                        for (const [notify] of notifications) {
                            (notify as NotificationCallback<O, M, E>)(
                                tData as ReceiverValue<O, M, E>,
                                sender,
                                () => pd.shared.listener.removeNotification(channel, notify),
                            );
                        }

                        break;
                    }
                    case StatusFlag.DUPLICATE_ID:
                    case StatusFlag.EXCEPTION:
                    case StatusFlag.ID_OK:
                    case StatusFlag.REQUEST_OK:
                    case StatusFlag.RESPONSE:
                        break;
                    default:
                        throw new Error(`${channel}: Unhandled status flag: ${StatusFlag[tStatus]}`);
                }
            } catch (error) {
                remove();
                emitError(error);
            }
        };

        if (pd.shared.listener.addReceiver(channel, listener, () => {
            for (const [, timeout] of timeouts) {
                clearTimeout(timeout);
            }
            for (const id of takenIds) {
                pd.shared.id.remove(id);
            }
            pd.ownedReceivers.delete(channel);
        })) {
            pd.ownedReceivers.add(channel);
        } else {
            throw new Error(`Only one callback for "${channel}" is allowed.`);
        }

        return this;
    }

    /**
     * Check if any instance of `IpcReceiver` has any data handlers.
     * @param owned Specify whether data handler must be owned by **this** object.
     */
    public hasDataHandler<M extends Methods, E extends Events<O, M>>(owned: boolean): boolean;
    /**
     * Check if any `IpcReceiver` with the same instance of `IpcShared` has specified data handler.
     * @param method Method to check for.
     * @param event Event to check for.
     * @param owned Specify whether data handler must be owned by **this** object.
     */
    public hasDataHandler<M extends Methods, E extends Events<O, M>>(method: M, event: E, owned: boolean): boolean;
    public hasDataHandler<M extends Methods, E extends Events<O, M>>(
        methodOrOwned?: M | boolean,
        event?: E,
        owned?: boolean,
    ) {
        const pd = getInternals(this);
        if (typeof methodOrOwned === "string" && typeof event === "string") {
            const channel = pd.shared.generateChannel(methodOrOwned, event);
            return owned ? pd.ownedReceivers.has(channel) : pd.shared.listener.hasReceiver(channel);
        } else {
            owned = typeof methodOrOwned === "boolean" && methodOrOwned;
            if (owned) {
                return pd.ownedReceivers.size > 0;
            } else {
                return pd.shared.listener.hasReceiver();
            }
        }
    }

    /**
     * Removes all data handlers from any `IpcReceiver` with the same instance of `IpcShared`.
     * @param owned Specify whether data handler must be owned by **this** object.
     */
    public removeDataHandler<M extends Methods, E extends Events<O, M>>(owned: boolean): this;
    /**
     * Removes data handler from any `IpcReceiver` with the same instance of `IpcShared`.
     * @param method Method to remove receiver from.
     * @param event Event to remove receiver from.
     * @param owned Specify whether data handler must be owned by **this** object.
     */
    public removeDataHandler<M extends Methods, E extends Events<O, M>>(method: M, event: E, owned: boolean): this;
    public removeDataHandler<M extends Methods, E extends Events<O, M>>(
        methodOrOwned?: M | boolean,
        event?: E,
        owned?: boolean,
    ): this {
        const pd = getInternals(this);
        if (typeof methodOrOwned === "string" && typeof event === "string") {
            const channel = pd.shared.generateChannel(methodOrOwned, event);
            if ((owned && pd.ownedReceivers.has(channel)) || !owned) {
                pd.shared.listener.removeReceiver(channel);
            }
        } else {
            owned = typeof methodOrOwned === "boolean" && methodOrOwned;
            if (owned) {
                for (const channel of pd.ownedReceivers) {
                    pd.shared.listener.removeReceiver(channel);
                }
            } else {
                pd.shared.listener.removeReceiver();
            }
        }
        return this;
    }

    /**
     * Add notification callback which is called **always** after data handler's callback
     * (does not wait for `async` callback to be resolved).
     * @param method Method to notify on.
     * @param event Event to notify on.
     * @param callback Callback to receive notification.
     * @param onRemove Optional callback to be called on removal.
     */
    public notifyOn<M extends Methods, E extends Events<O, M>>(
        method: M,
        event: E,
        callback: NotificationCallback<O, M, E>,
        onRemove?: ListenerRemoveCallback,
    ): this {
        const pd = getInternals(this);
        const channel = pd.shared.generateChannel(method, event);
        if (pd.shared.listener.addNotification(channel, callback, () => {
            pd.ownedNotifications.delete(callback);
            if (typeof onRemove === "function") {
                onRemove();
            }
        })) {
            pd.ownedNotifications.add(callback);
        } else {
            throw new Error(`Notification with the same callback for "${channel}" already exists.`);
        }

        return this;
    }

    /**
     * Check if any instance of `IpcReceiver` has any or specified notification.
     * @param owned Specify whether data handler must be owned by **this** object.
     * @param callback Optional notification callback to check for.
     */
    public hasNotification<M extends Methods, E extends Events<O, M>>(
        owned: boolean,
        callback?: NotificationCallback<O, M, E>,
    ): boolean;
    /**
     * Check if any `IpcReceiver` with the same instance of `IpcShared` has any or specified notification.
     * @param method Method to check for.
     * @param event Event to check for.
     * @param owned Specify whether data handler must be owned by **this** object.
     * @param callback Optional notification callback to check for.
     */
    public hasNotification<M extends Methods, E extends Events<O, M>>(
        method: M,
        event: E,
        owned: boolean,
        callback?: NotificationCallback<O, M, E>,
    ): boolean;
    public hasNotification<M extends Methods, E extends Events<O, M>>(
        methodOrOwned?: M | boolean,
        eventOrCallback?: E | NotificationCallback<O, M, E>,
        owned?: boolean,
        callback?: NotificationCallback<O, M, E>,
    ) {
        const pd = getInternals(this);
        if (typeof methodOrOwned === "string" && typeof eventOrCallback === "string") {
            const channel = pd.shared.generateChannel(methodOrOwned, eventOrCallback);
            if (
                (
                    owned
                    && callback
                    && pd.ownedNotifications.has(callback)
                )
                || !owned
            ) {
                return pd.shared.listener.hasNotification(channel, callback);
            } else {
                return false;
            }
        } else {
            owned = typeof methodOrOwned === "boolean" && methodOrOwned;
            callback = typeof eventOrCallback === "function" ? eventOrCallback : undefined;
            if (owned) {
                return pd.ownedReceivers.size > 0 && callback ? pd.ownedNotifications.has(callback) : true;
            } else {
                return pd.shared.listener.hasNotification(undefined, callback);
            }
        }
    }

    /**
     * Removes all or specified notification(-s) from any `IpcReceiver` with the same instance of `IpcShared`.
     * @param owned Specify whether data handler must be owned by **this** object.
     * @param callback Optional notification callback to remove.
     */
    public removeNotification<M extends Methods, E extends Events<O, M>>(
        owned: boolean,
        callback?: NotificationCallback<O, M, E>,
    ): this;
    /**
     * Removes all or specified notification(-s) from any `IpcReceiver` with the same instance of `IpcShared`.
     * @param method Method to remove receiver from.
     * @param event Event to remove receiver from.
     * @param owned Specify whether data handler must be owned by **this** object.
     * @param callback Optional notification callback to remove.
     */
    public removeNotification<M extends Methods, E extends Events<O, M>>(
        method: M,
        event: E,
        owned: boolean,
        callback?: NotificationCallback<O, M, E>,
    ): this;
    public removeNotification<M extends Methods, E extends Events<O, M>>(
        methodOrOwned?: M | boolean,
        eventOrCallback?: E | NotificationCallback<O, M, E>,
        owned?: boolean,
        callback?: NotificationCallback<O, M, E>,
    ): this {
        const pd = getInternals(this);
        if (typeof methodOrOwned === "string" && typeof eventOrCallback === "string") {
            const channel = pd.shared.generateChannel(methodOrOwned, eventOrCallback);
            if (
                (
                    owned
                    && callback
                    && pd.ownedNotifications.has(callback)
                )
                || !owned
            ) {
                pd.shared.listener.removeNotification(channel, callback);
            }
        } else {
            owned = typeof methodOrOwned === "boolean" && methodOrOwned;
            callback = typeof eventOrCallback === "function" ? eventOrCallback : undefined;
            if (owned) {
                for (const notification of pd.ownedNotifications) {
                    pd.shared.listener.removeNotification(undefined, notification);
                }
            } else {
                pd.shared.listener.removeNotification(undefined, callback);
            }
        }
        return this;
    }

    /**
     * Clone receiver instance.
     * @param errorListeners Copy error listener callbacks.
     * @returns A cloned instance of receiver without any of the parent' data.
     */
    public clone(errorListeners: boolean = false) {
        const pd = getInternals(this);
        const clone = new IpcReceiver(pd.shared, pd.sendMethod, {
            respTimeout: this.respTimeout,
        }) as IpcReceiver<O>;
        if (errorListeners) {
            clone.onError = new Set([...this.onError]);
        }
        return clone;
    }
}
