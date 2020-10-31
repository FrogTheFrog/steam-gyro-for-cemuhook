import { DOCUMENT } from "@angular/common";
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, Renderer2 } from "@angular/core";
import { fromEventPattern, merge, Subscription } from "rxjs";
import { mapTo, takeUntil } from "rxjs/operators";
import { MessageLogService } from "./message-log/message-log.service";
import { IpcService } from "./shared/services/ipc.service";

/**
 * Returns an event observable for window events.
 *
 * @param event Event to observe.
 * @param ipc IPC service.
 * @returns Event observable.
 */
function fromWindowEvent<T extends string>(event: T, ipc?: IpcService) {
    return fromEventPattern(
        (handler) =>
            ipc ? ipc.window.addListener(event as any, handler) : window.addEventListener(event, handler as any),
        (handler) =>
            ipc ? ipc.window.removeListener(event as any, handler) : window.removeEventListener(event, handler as any),
    ).pipe(mapTo(event));
}

/**
 * App entry component.
 */
@Component({
    selector: "app",
    styleUrls: ["./app.style.scss"],
    templateUrl: "./app.template.html",
})
export class AppComponent implements OnInit, OnDestroy {
    /**
     * Specifies whether any device is currently connected.
     */
    public deviceStatus: boolean = false;

    /**
     * Specifies whether any UDP connection is established.
     */
    public connectionStatus: boolean = false;

    /**
     * Stores various subscriptions for clean up.
     */
    private subscriptions!: Subscription;

    /**
     * Standalone instance of `ipcReceiver` for clean up.
     */
    private ipcReceiver!: IpcService["receiver"];

    constructor(
        private ipc: IpcService,
        private renderer: Renderer2,
        private changeRef: ChangeDetectorRef,
        private messageService: MessageLogService,
        @Inject(DOCUMENT) private document: Document,
    ) { }

    /**
     * Initiate main component - add various event listeners.
     */
    public ngOnInit() {
        this.ipcReceiver = this.ipc.receiver.clone();
        this.ipcReceiver.onError.add(this.messageService.errorHandler);
        this.ipcReceiver.on("PUT", "device-status", (status) => {
            this.deviceStatus = status;
            this.changeRef.detectChanges();
        });
        this.ipcReceiver.on("PUT", "connection-status", (status) => {
            this.connectionStatus = status;
            this.changeRef.detectChanges();
        });

        this.subscriptions = merge(
            fromWindowEvent("maximize", this.ipc),
            fromWindowEvent("unmaximize", this.ipc),
        ).pipe(takeUntil(fromWindowEvent("beforeunload"))).subscribe((event) => {
            if (event === "maximize") {
                this.renderer.removeClass(this.document.body, "window-resize-border");
            } else if (event === "unmaximize") {
                this.renderer.addClass(this.document.body, "window-resize-border");
            }
        },  this.messageService.errorHandler);

        if (!this.ipc.window.isMaximized()) {
            this.renderer.addClass(this.document.body, "window-resize-border");
        }

        this.ipc.sender.notify("POST", "device-status", true);
        this.ipc.sender.notify("POST", "connection-status", true);
    }

    /**
     * Clean up after subscriptions and event listeners.
     */
    public ngOnDestroy() {
        this.ipc.sender.notify("POST", "device-status", false);
        this.ipc.sender.notify("POST", "connection-status", false);

        this.ipcReceiver.removeDataHandler(true);
        this.subscriptions.unsubscribe();
    }

    /**
     * Closes window..
     */
    public close() {
        this.ipc.window.close();
    }
}
