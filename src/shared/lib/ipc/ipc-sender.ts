import {
    AllEvents as Events,
    AllMethods as Methods,
    EventSenderLike,
    ExtractReceiverValue as ReceiverResponse,
    ExtractSenderValue as SenderValue,
    MethodicalEvents,
    RequestErrorListener,
    SenderFunction,
    SenderRequestOptions as Options,
    SenderTimeouts,
    SendMethod,
    SourceSender,
    StatusFlag,
    UniqueID,
} from "../../models/ipc.models";
import { privateData } from "../private-data";
import { IpcShared } from "./ipc-shared";
import { IpcTimeout } from "./ipc-timeout";

/**
 * Internal data for `IpcSender`.
 */
interface InternalData<S extends SendMethod> {
    shared: IpcShared;
    sendMethod: S;
}

/**
 * Internal data accessor for `IpcSender`.
 */
const getInternals = privateData() as
    <O extends MethodicalEvents, S extends SendMethod>(self: IpcSender<O, S>, init: InternalData<S> | void)
        => InternalData<S>;

/**
 * Generates send function for `IpcSender`.
 * @param sendMethod Send function or object used for sending data.
 * @param webContentsId Web contents ID to send data to.
 */
function generateSendFn<
    O extends MethodicalEvents,
    M extends Methods,
    E extends Events<O, M>
>(sendMethod: SendMethod, webContentsId?: number): SenderFunction<SenderValue<O, M, E>> {
    if (typeof sendMethod === "function") {
        return sendMethod;
    } else {
        const isDestroyed = () =>  typeof sendMethod.isDestroyed === "function" ? sendMethod.isDestroyed() : false;
        if (typeof webContentsId === "number") {
            return (channel, data) => {
                if (!isDestroyed()){
                    sendMethod.sendTo(webContentsId, channel, data);
                }
            };
        } else {
            return (channel, data) => {
                if (!isDestroyed()){
                    sendMethod.send(channel, data);
                }
            };
        }
    }
}

/**
 * IPC wrapper for sending data.
 */
export class IpcSender<O extends MethodicalEvents, S extends SendMethod> {
    /**
     * Global request timeout value (allowed time it takes to receive various status flags from listener).
     */
    public reqTimeout: number;

    /**
     * Global response timeout value (allowed time it takes to receive response from listener **after**
     * if has been confirmed that request was successful).
     */
    public respTimeout: number;

    /**
     * A set of error callbacks to be called on error.
     */
    public onError: Set<RequestErrorListener<O>> = new Set();

    /**
     * @param shared Shared data manager.
     * @param sendMethod Send function or object used for sending data.
     * @param timeouts Optional timeout object for setting global timeouts.
     */
    constructor(shared: IpcShared, sendMethod: S, timeouts?: SenderTimeouts) {
        const { reqTimeout = 10000, respTimeout = 10000 } = timeouts || {};

        this.reqTimeout = reqTimeout;
        this.respTimeout = respTimeout;
        getInternals(this, {
            sendMethod,
            shared,
        });
    }

    /**
     * Sends a one-way notification to listener.
     * @param method Method to notify by.
     * @param event Event to request by.
     * @param callback Data to send.
     * @param webContentsId Optional id to be used as a target.
     */
    public notify<M extends Methods, E extends Events<O, M>>(
        method: M,
        event: E,
        data: SenderValue<O, M, E>,
        webContentsId?: number,
    ) {
        const pd = getInternals(this);
        const channel = pd.shared.generateChannel(method, event);
        const send = generateSendFn<O, M, E>(pd.sendMethod, webContentsId);

        send(channel, [StatusFlag.NOTIFICATION, 0, data]);
    }

    /**
     * Initiates request to listener.
     * @param method Method to request by.
     * @param event Event to request by.
     * @param callback Data to send.
     * @param options Custom request options.
     */
    public request<M extends Methods, E extends Events<O, M>>(
        method: M,
        event: E,
        data: SenderValue<O, M, E>,
        options?: Options<S>,
    ) {
        const pd = getInternals(this);
        const {
            reqTimeout = this.reqTimeout,
            respTimeout = this.respTimeout,
            doNotEmitToListeners,
            webContentsId,
        } = (options || {}) as Options<EventSenderLike>;
        
        const channel = pd.shared.generateChannel(method, event);
        const send = generateSendFn<O, M, E>(pd.sendMethod, webContentsId);

        return new Promise<ReceiverResponse<O, M, E>>((resolve, reject) => {
            const timeout = new IpcTimeout(() => onError(new Error(`${channel}: Target did not respond.`)));
            const removeIdSafe = () => {
                if (id !== undefined) {
                    pd.shared.id.remove(id);
                }
            };
            const removeListenerSafe = () => {
                if (listener !== undefined) {
                    pd.shared.listener.removeSender(channel, listener);
                }
            };
            const onError = (error: Error) => {
                timeout.clear();
                removeIdSafe();
                removeListenerSafe();

                if (!doNotEmitToListeners) {
                    for (const errorCallback of this.onError) {
                        errorCallback(error, method, event as unknown as Events<O, Methods>);
                    }
                }

                reject(error);
            };
            let listener: SourceSender<ReceiverResponse<O, M, E>> | undefined;
            let duplicateIdCounter: number = 0;
            let id: UniqueID | undefined;
            try {
                id = pd.shared.id.generate();
                listener = (ev, transferData, remove) => {
                    const [tStatus, tId, tData = void 0] = transferData;

                    if (id === tId) {
                        switch (tStatus) {
                            case StatusFlag.DUPLICATE_ID: {
                                if (duplicateIdCounter++ < 100) {
                                    timeout.clear();
                                    id = pd.shared.id.remove(id).generate();
                                    timeout.update(reqTimeout, remove);
                                    send(channel, [StatusFlag.CONFIRM_ID, id]);
                                } else {
                                    throw new Error(`${channel}: Too many duplicate id retries.`);
                                }
                                break;
                            }
                            case StatusFlag.ID_OK: {
                                timeout.update(respTimeout, remove);
                                send(channel, [StatusFlag.REQUEST, id, data]);
                                break;
                            }
                            case StatusFlag.REQUEST_OK: {
                                timeout.update(respTimeout, remove);
                                break;
                            }
                            case StatusFlag.RESPONSE: {
                                timeout.clear();
                                send(channel, [StatusFlag.RESPONSE_OK, tId]);

                                remove();
                                resolve(tData as ReceiverResponse<O, M, E>);
                                break;
                            }
                            case StatusFlag.EXCEPTION: {
                                timeout.clear();

                                throw new Error(
                                    typeof tData === "string" ?
                                        tData :
                                        "Unhandled exception has occurred on the other side",
                                );
                            }
                            default:
                                throw new Error(`${channel}: Unhandled status flag: ${StatusFlag[tStatus]}`);
                        }
                    }
                };

                pd.shared.listener.addSender(channel, listener, () => {
                    timeout.clear();
                    removeIdSafe();
                });
                timeout.update(reqTimeout, removeListenerSafe);
                send(channel, [StatusFlag.CONFIRM_ID, id]);
            } catch (error) {
                onError(error);
            }
        });
    }

    /**
     * Clone sender instance.
     * @param errorListeners Copy error listener callbacks.
     * @returns A cloned instance of sender without any of the parent' data.
     */
    public clone(errorListeners: boolean = false) {
        const pd = getInternals(this);
        const clone = new IpcSender(pd.shared, pd.sendMethod, {
            reqTimeout: this.reqTimeout,
            respTimeout: this.respTimeout,
        }) as IpcSender<O, S>;
        if (errorListeners) {
            clone.onError = new Set([...this.onError]);
        }
        return clone;
    }
}
