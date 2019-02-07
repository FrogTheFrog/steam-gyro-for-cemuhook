import { Injectable } from "@angular/core";
import { remote } from "electron";
import { idBasedUniqueIdGenerator } from "../../../../shared/lib/ipc";
import { IpcEvents } from "../../../../shared/models";
import { IpcRenderer } from "../../../lib/ipc-renderer";

/**
 * Manages communication between Renderer and Main window.
 */
@Injectable({
    providedIn: "root",
})
export class IpcService extends IpcRenderer<IpcEvents> {
    constructor() {
        super(idBasedUniqueIdGenerator(remote.getCurrentWindow().id));
    }

    /**
     * Returns instance of current window.
     */
    public get window() {
        return remote.getCurrentWindow();
    }
}
