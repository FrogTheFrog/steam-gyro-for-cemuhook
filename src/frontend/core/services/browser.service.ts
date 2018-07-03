import { Injectable } from "@angular/core";
import { BrowserWindow, remote } from "electron";
import { Subject } from "rxjs";

type TrackedEvents = "show" | "hide" | "maximize" | "unmaximize";

@Injectable()
export class BrowserService {
    private currentWindow: BrowserWindow = remote.getCurrentWindow();
    private eventHandler: Subject<TrackedEvents> = new Subject();

    constructor() {
        const events: TrackedEvents[] = ["show", "hide", "maximize", "unmaximize"];
        for (const event of events) {
            this.currentWindow.on(event as any, () => {
                this.eventHandler.next(event);
            });
        }
    }

    public hide() {
        this.currentWindow.close();
    }

    get window() {
        return this.currentWindow;
    }

    get events() {
        return this.eventHandler.asObservable();
    }
}
