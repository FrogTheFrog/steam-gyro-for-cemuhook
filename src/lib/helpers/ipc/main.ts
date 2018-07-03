import { ipcMain, webContents } from "electron";
import { Subject } from "rxjs";
import { IpcCallback } from "../../../models/type/ipc-callback.type";
import { IpcEvent } from "../../../models/type/ipc-event.type";

export class IpcMainManager<Receive extends object, Send extends object> {
    private eventSubject = new Subject<IpcEvent<Receive, Send>>();
    private eventMap = new Map<Extract<keyof Receive, string>, (
        ipcEvent: {
            returnType: any,
            sender: webContents,
        },
        data: Receive[Extract<keyof Receive, string>],
    ) => void>();
    private callbackMap = new Map<Extract<
        keyof Receive, string>,
        IpcCallback<Receive, Send, Extract<keyof Receive, string>>
        >();

    get events() {
        return this.eventSubject.asObservable();
    }

    public on<Event extends Extract<keyof Receive, string>>(
        event: Event,
        callback?: IpcCallback<Receive, Send, Event>,
    ) {
        this.listen(event, false, callback);
        return this;
    }

    public once<Event extends Extract<keyof Receive, string>>(
        event: Event,
        callback?: IpcCallback<Receive, Send, Event>,
    ) {
        this.listen(event, true, callback);
        return this;
    }

    public removeListener<Event extends Extract<keyof Receive, string>>(event: Event) {
        if (!this.eventMap.has(event)) {
            ipcMain.removeListener(event, this.eventMap.get(event)!);
            this.eventMap.delete(event);

            if (this.callbackMap.has(event)) {
                this.callbackMap.delete(event);
            }
        }
        return this;
    }

    public removeAllListeners() {
        for (const [key] of this.eventMap) {
            this.removeListener(key);
        }
        return this;
    }

    private listen<Event extends Extract<keyof Receive, string>>(
        event: Event,
        once: boolean,
        callback?: IpcCallback<Receive, Send, Event>,
    ) {
        if (!this.eventMap.has(event)) {
            this.eventMap.set(event, (ipcEvent, data) => {
                this.eventHandler(event, ipcEvent.sender, data);
            });
            ipcMain[once ? "once" : "on"](event, this.eventMap.get(event)!);
        }

        if (callback) {
            this.callbackMap.set(event, callback as IpcCallback<Receive, Send, Extract<keyof Receive, string>>);
        }
        else if (this.callbackMap.has(event)) {
            this.callbackMap.delete(event);
        }
    }

    private eventHandler(
        event: Extract<keyof Receive, string>,
        sender: webContents,
        data: Receive[Extract<keyof Receive, string>],
    ) {
        const callback = this.callbackMap.get(event);
        if (callback) {
            callback(data, sender.send);
        }
        this.eventSubject.next({ event, value: data, response: sender.send });
    }
}
