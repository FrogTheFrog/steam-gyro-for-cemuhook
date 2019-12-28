import { ipcMain, WebContents } from "electron";
import { idBasedUniqueIdGenerator, IpcReceiver, IpcSender, IpcShared, privateData } from "../../shared/lib";
import { MethodicalEvents, SenderFunction, UniqueIDGenerator } from "../../shared/models";

/**
 * Internal data for `IpcMain`.
 */
interface InternalData<O extends MethodicalEvents> {
    listener: IpcReceiver<O>;
    shared: IpcShared;
}

/**
 * Internal data accessor for `IpcMain`.
 */
const getInternals = privateData() as
    <O extends MethodicalEvents>(self: IpcMain<O>, init: InternalData<O> | void)
        => InternalData<O>;

/**
 * IPC wrapper class for main process.
 */
export class IpcMain<O extends MethodicalEvents> {
    /**
     * @param uidGenerator Generator function for generating unique ids.
     */
    constructor(uidGenerator: UniqueIDGenerator = idBasedUniqueIdGenerator(0)) {
        const shared = new IpcShared(ipcMain, uidGenerator);
        getInternals(this, {
            listener: new IpcReceiver(shared),
            shared,
        });
    }

    /**
     * Instance of `IpcReceiver`.
     */
    public get receiver(): IpcReceiver<O> {
        return getInternals(this).listener;
    }

    /**
     * Create `IpcSender` instance from `webContents` object.
     * @param webContents Instance of `webContents` used to send data.
     */
    public createSender(webContents: WebContents): IpcSender<O, SenderFunction<any>> {
        return new IpcSender(getInternals(this).shared, (channel, data) => {
            if (!webContents.isDestroyed()) {
                webContents.send(channel, data);
            }
        });
    }
}
