import { Injectable, NgZone, OnDestroy } from "@angular/core";
import { fromEventPattern, Observable } from "rxjs";
import { mergeMap, share } from "rxjs/operators";
import { MessageLogService } from "../message-log/message-log.service";
import { IpcService } from "../shared/services/ipc.service";

@Injectable()
export class DataStreamService implements OnDestroy {
    /**
     * Streamed data observable.
     */
    public stream: Observable<object>;

    /**
     * Standalone instance of `ipcReceiver` for clean up.
     */
    private ipcReceiver: IpcService["receiver"];

    constructor(private ipc: IpcService, private messageService: MessageLogService, private zone: NgZone) {
        this.ipcReceiver = this.ipc.receiver.clone();
        this.ipcReceiver.onError.add(this.messageService.errorHandler);
        this.ipcReceiver.on("PUT", "data-stream", () => void (0));
        this.stream = fromEventPattern<[object]>(
            (handler) => this.ipcReceiver.notifyOn("PUT", "data-stream", handler as any),
            (handler) => this.ipcReceiver.removeNotification("PUT", "data-stream", handler as any),
        ).pipe(
            mergeMap(([v]) => new Promise<object>((r) => { this.zone.run(() => r(v)); })),
            share(),
        );
    }

    /**
     * Starts data stream.
     */
    public start() {
        return this.ipc.sender.request("POST", "data-stream", true).catch(this.messageService.errorHandler);
    }

    /**
     * Stops data stream.
     */
    public stop() {
        return this.ipc.sender.request("POST", "data-stream", false).catch(this.messageService.errorHandler);
    }

    /**
     * Cleanup.
     */
    public ngOnDestroy() {
        this.stop().then(() => {
            this.ipcReceiver.removeDataHandler(true);
            this.ipcReceiver.removeNotification(true);
        });
    }
}
