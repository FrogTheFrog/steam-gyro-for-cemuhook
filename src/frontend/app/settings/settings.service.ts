import { Injectable, NgZone } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { TypedFilterData }from "../../../controller-api"
import { UserSettings } from "../../../shared/models";
import { MessageLogService } from "../message-log/message-log.service";
import { IpcService } from "../shared/services/ipc.service";
import { GraphData } from "./graph/graph-data";

/**
 * Service for handling settings exchange.
 */
@Injectable()
export class SettingsService {
    /**
     * Indicates whether server is currently restarting.
     */
    public serverIsRestarting = new BehaviorSubject<boolean>(false);

    /**
     * Indicates whether data is currently streaming.
     */
    public dataIsStreaming = new BehaviorSubject<boolean>(false);

    /**
     * Instance of `GraphData`.
     */
    public graphData: GraphData;

    /**
     * Standalone instance of `ipcReceiver` for clean up.
     */
    private ipcReceiver: IpcService["receiver"];

    /**
     * Cached server settings.
     */
    private serverSettings: UserSettings["server"] | null = null;

    /**
     * Cached server settings.
     */
    private filterSettings: UserSettings["filter"] | null = null;

    /**
     * Instance of `NodeJS.Timeout` for `motionDataTimeout` method.
     */
    private dataTimeout: NodeJS.Timeout | null = null;

    constructor(private ipc: IpcService, private messageService: MessageLogService, private zone: NgZone) {
        this.graphData = new GraphData(zone);
        this.ipcReceiver = this.ipc.receiver.clone();
        this.ipcReceiver.onError.add(this.messageService.errorHandler);
        this.ipcReceiver.on("POST", "motion-data-stream", (data) => {
            this.clearMotionDataTimeout();
            this.graphData.addData(data);
            this.startMotionDataTimeout();
        });
    }

    /**
     * Temporarily store address in main process.
     *
     * @param address Address to store.
     */
    public storeAddress(address: string) {
        if (this.serverSettings !== null) {
            this.serverSettings.address = address;
        }
        return this.ipc.sender.request("PUT", "settings:server:address", address);
    }

    /**
     * Temporarily store port in main process.
     *
     * @param port Port to store.
     */
    public storePort(port: number) {
        if (this.serverSettings !== null) {
            this.serverSettings.port = port;
        }
        return this.ipc.sender.request("PUT", "settings:server:port", port);
    }

    /**
     * Retrieve temporarily stored server settings.
     */
    public getServerSettings() {
        return Promise.resolve(this.serverSettings).then((data) => {
            if (data === null) {
                return this.ipc.sender.request("GET", "settings:server", void 0).then((value) => {
                    this.serverSettings = value;
                    return value;
                });
            } else {
                return data;
            }
        });
    }

    /**
     * Retrieve temporarily stored filter settings.
     */
    public getFilterSettings() {
        return Promise.resolve(this.filterSettings).then((data) => {
            if (data === null) {
                return this.ipc.sender.request("GET", "settings:filter", void 0).then((value) => {
                    this.filterSettings = value;
                    return value;
                });
            } else {
                return data;
            }
        });
    }

    /**
     * Temporarily store filter data.
     *
     * @param data Filter data to store.
     */
    public setFilterData(data: TypedFilterData) {
        if (this.filterSettings !== null) {
            this.filterSettings.type = data.type;
            (this.filterSettings.data[data.type] as number[]) = data.value;
        }
        return this.ipc.sender.request("PUT", "settings:filter", data);
    }

    /**
     * Restart server.
     */
    public restartServer() {
        if (!this.serverIsRestarting.value) {
            this.serverIsRestarting.next(true);
            this.ipc.sender.request("POST", "restart-server", void 0)
                .catch(this.messageService.errorHandler)
                .then(() => this.serverIsRestarting.next(false));
        }
    }

    /**
     * Starts motion data stream.
     */
    public startMotionDataStream() {
        return Promise.resolve(this.dataIsStreaming.value)
            .then((streaming) => {
                if (!streaming) {
                    this.graphData.clearData();
                    this.dataIsStreaming.next(true);
                    return this.ipc.sender.request("POST", "motion-data-stream", true)
                        .catch(this.messageService.errorHandler) as Promise<void>;
                }
            });
    }

    /**
     * Stops motion data stream.
     */
    public stopMotionDataStream() {
        return Promise.resolve(this.dataIsStreaming.value)
            .then((streaming) => {
                if (streaming) {
                    this.clearMotionDataTimeout();
                    this.dataIsStreaming.next(false);
                    return this.ipc.sender.request("POST", "motion-data-stream", false)
                        .catch(this.messageService.errorHandler) as Promise<void>;
                }
            });
    }

    /**
     * Cleanup.
     */
    public ngOnDestroy() {
        this.stopMotionDataStream().then(() => {
            this.ipcReceiver.removeDataHandler(true);
            this.ipcReceiver.removeNotification(true);
        });
    }

    /**
     * Starts timeout to stop data stream incase data stops coming.
     */
    private startMotionDataTimeout() {
        this.clearMotionDataTimeout();
        this.dataTimeout = setTimeout(() => {
            this.dataTimeout = null;
            this.zone.run(() => this.stopMotionDataStream());
        }, 50);
    }

    /**
     * Clears timeout which stops data stream.
     */
    private clearMotionDataTimeout() {
        if (this.dataTimeout !== null) {
            clearTimeout(this.dataTimeout);
            this.dataTimeout = null;
        }
    }
}
