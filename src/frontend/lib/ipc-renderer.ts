import { ipcRenderer } from "electron";
import { IpcReceiver, IpcSender, IpcShared, privateData } from "../../shared/lib";
import { EventSenderLike, flip, MethodicalEvents, UniqueIDGenerator } from "../../shared/models";

/**
 * Internal data for `IpcRenderer`.
 */
interface InternalData<O extends MethodicalEvents> {
    listener: IpcReceiver<flip<O>>;
    sender: IpcSender<flip<O>, EventSenderLike>;
    shared: IpcShared;
}

/**
 * Internal data accessor for `IpcRenderer`.
 */
const getInternals = privateData() as
    <O extends MethodicalEvents>(self: IpcRenderer<O>, init: InternalData<O> | void)
        => InternalData<O>;

/**
 * IPC wrapper class for renderer process.
 */
export class IpcRenderer<O extends MethodicalEvents> {
    /**
     * @param uidGenerator Generator function for generating unique ids.
     */
    constructor(uidGenerator: UniqueIDGenerator) {
        const shared = new IpcShared(ipcRenderer, uidGenerator);
        getInternals(this, {
            listener: new IpcReceiver(shared, ipcRenderer),
            sender: new IpcSender<flip<O>, EventSenderLike>(shared, ipcRenderer),
            shared,
        });
    }

    /**
     * Instance of `IpcReceiver`.
     */
    public get receiver(): IpcReceiver<flip<O>> {
        return getInternals(this).listener;
    }

    /**
     * Instance of `IpcSender`.
     */
    public get sender(): IpcSender<flip<O>, EventSenderLike> {
        return getInternals(this).sender;
    }
}
