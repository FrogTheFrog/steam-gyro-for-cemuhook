import { Overlay, OverlayRef } from "@angular/cdk/overlay";
import { ComponentPortal, PortalInjector } from "@angular/cdk/portal";
import { Injectable, Injector, NgZone, OnDestroy } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { ErrorObject, MessageObject } from "../../../shared/models";
import { IpcService } from "../shared/services/ipc.service";
import { ErrorComponent } from "./error/error.component";
import { InfoComponent } from "./info/info.component";
import { MESSAGE_OBJECT_DATA } from "./message-data.token";
import { MessageOverlayRef } from "./message-overlay-ref";

/**
 * Service to store messages and notify user about them.
 */
@Injectable({
    providedIn: "root",
})
export class MessageLogService implements OnDestroy {
    /**
     * Stored messages.
     */
    public list = new BehaviorSubject<MessageObject[]>([]);

    /**
     * Standalone instance of `ipcReceiver` for clean up.
     */
    private ipcReceiver: IpcService["receiver"];

    /**
     * Reference to last overlay.
     */
    private lastOverlay: MessageOverlayRef | null = null;

    constructor(private ipc: IpcService, private overlay: Overlay, private injector: Injector, private zone: NgZone) {
        this.ipcReceiver = this.ipc.receiver.clone();
        this.ipcReceiver.onError.add(this.errorHandler);
        this.ipcReceiver.on("POST", "message", (data) => {
            this.zone.run(() => {
                const { display, message } = data;
                this.addToList(message);
                if (display) {
                    this.open(message);
                }
            });
        });

        this.ipc.sender.request("GET", "messages", void (0)).then((data) => {
            this.zone.run(() => {
                this.list.next(data);
            });
        }).catch(this.errorHandler);
    }

    /**
     * Cleanup.
     */
    public ngOnDestroy() {
        this.ipcReceiver.removeDataHandler(true);
    }

    /**
     * Add error message to the list.
     * @param error Value to add.
     * @returns Constructed error object.
     */
    public error(error: Error) {
        const data: ErrorObject = {
            data: { name: error.name, message: error.message, stack: error.stack },
            type: "error",
        };
        this.addToList(data);
        this.ipc.sender.request("POST", "message", data).then();
        return data;
    }

    /**
     * Opens overlay to display message.
     * @param message Message to display.
     */
    public open(message: MessageObject) {
        if (this.lastOverlay === null || !this.lastOverlay.isOpen()) {
            const overlayRef = this.overlay.create({
                backdropClass: "dark-backdrop",
                hasBackdrop: true,
                positionStrategy: this.overlay
                    .position()
                    .global()
                    .centerHorizontally()
                    .centerVertically(),
                scrollStrategy: this.overlay.scrollStrategies.block(),
            });
            const messageRef = new MessageOverlayRef(overlayRef);

            this.attachComponent(overlayRef, message, messageRef);
            overlayRef.backdropClick().subscribe(() => overlayRef.detach());

            return messageRef;
        } else {
            return null;
        }
    }

    /**
     * Generates error handler.
     */
    public get errorHandler(): (error: Error) => void {
        return (error: Error) => this.error(error);
    }

    /**
     * Add message to list.
     * @param message Message to add.
     */
    private addToList(message: MessageObject) {
        this.zone.run(() => {
            this.list.next([...this.list.value, message]);
        });
    }

    /**
     * Creates injector to inject overlay reference and message data into component.
     * @param message Data to inject.
     * @param messageRef Reference to overlay.
     */
    private createInjector(message: MessageObject, messageRef: MessageOverlayRef) {
        const injectionTokens = new WeakMap();

        injectionTokens.set(MessageOverlayRef, messageRef);
        injectionTokens.set(MESSAGE_OBJECT_DATA, message.data);

        return new PortalInjector(this.injector, injectionTokens);
    }

    /**
     * Attaches correct component to overlay.
     * @param overlayRef Overlay to attach to.
     * @param message Message to pass to component.
     * @param messageRef Message overlay reference.
     */
    private attachComponent(overlayRef: OverlayRef, message: MessageObject, messageRef: MessageOverlayRef) {
        const injector = this.createInjector(message, messageRef);

        switch (message.type) {
            case "error":
                return overlayRef.attach(new ComponentPortal(ErrorComponent, null, injector)).instance;
            case "info":
                return overlayRef.attach(new ComponentPortal(InfoComponent, null, injector)).instance;
            default:
                throw new Error("Unhandled message type.");
        }
    }
}
