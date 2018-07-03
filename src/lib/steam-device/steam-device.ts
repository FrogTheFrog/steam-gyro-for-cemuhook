import { Subject, Subscription } from "rxjs";
import { GenericSteamDeviceEvents } from "../../models/interface/generic-steam-device-events.interface";
import { GenericEvent } from "../../models/type/generic-event.type";
import GenericSteamDevice from "./generic-steam-device";
import SteamHidDevice from "./steam-hid-device";

export default class SteamDevice {
    private connectionTimestamp: number = 0;
    private lastValidSensorPacket: number = 0;
    private device: GenericSteamDevice | null = null;
    private deviceEvents = new Subscription();
    private watcherEvents = new Subscription();
    private eventSubject = new Subject<GenericEvent<GenericSteamDeviceEvents>>();
    private watcher = { timer: null as (NodeJS.Timer | null), isWatching: false };

    get events() {
        return this.eventSubject.asObservable();
    }

    public get rawReport() {
        return this.device != null ? this.device.rawReport : null;
    }

    public get motionData() {
        return this.device != null ? this.device.motionData : null;
    }

    public open() {
        this.close();

        this.device = (() => {
            // Try HID devices first
            const device = new SteamHidDevice();
            if (device.open().isOpen()) {
                return device;
            }

            return null;
        })();

        if (this.isOpen()) {
            this.deviceEvents = this.device!.events.subscribe((data) => {
                switch (data.event) {
                    case "close":
                        this.close();
                        break;
                    default:
                        this.eventSubject.next(data);
                        break;
                }
            });
        }

        return this;
    }

    public close() {
        if (this.isOpen()) {
            this.deviceEvents.unsubscribe();
            this.device!.close();
            this.device = null;

            this.eventSubject.next({ event: "close", value: void 0 });
        }

        return this;
    }

    public isOpen() {
        return this.device !== null;
    }

    public startWatching() {
        if (!this.watcher.isWatching) {
            this.watcher.isWatching = true;
            this.watcherEvents = SteamHidDevice.staticEvents.subscribe((data) => {
                if (data.event === "listChanged") {
                    this.watcherCallback();
                }
            });
            SteamHidDevice.startMonitoring();
            this.watcherCallback();
        }
    }

    public stopWatching() {
        if (this.watcher.isWatching) {
            this.watcher.isWatching = false;
            this.watcherEvents.unsubscribe();
            SteamHidDevice.stopMonitoring();
        }
    }

    private watcherCallback() {
        if (this.watcher.timer !== null) {
            clearTimeout(this.watcher.timer);
            this.watcher.timer = null;
        }

        if (this.watcher.isWatching && !this.isOpen() && !this.open().isOpen()) {
            this.watcher.timer = global.setTimeout(() => this.watcherCallback(), 1000);
        }
    }
}
