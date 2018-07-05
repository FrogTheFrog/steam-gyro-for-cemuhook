import { Subject } from "rxjs";
import { SteamControllerEvents } from "../models/interface/steam-controller-events.interface";
import { GenericEvent } from "../models/type/generic-event.type";
import { DualshockGenericController } from "./dualshock-generic-controller";
import SteamDevice from "./steam-device/steam-device";

export default class GenericController extends DualshockGenericController {
    private device: SteamDevice = new SteamDevice();
    private eventSubject = new Subject<GenericEvent<SteamControllerEvents>>();

    constructor(private id: number) {
        super();
        this.device.events.subscribe((data) => {
            switch (data.event) {
                case "report":
                    this.eventSubject.next(data);
                    this.eventSubject.next({
                        event: "dualshockData",
                        value: {
                            meta: this.device.reportToDualshockMeta(data.value, this.id)!,
                            report: this.device.reportToDualshockReport(data.value)!,
                        },
                    });
                    break;
                default:
                    this.eventSubject.next(data);
                    break;
            }
        });
    }

    public get rawReport() {
        return this.device.isOpen() ? this.device.rawReport : null;
    }

    public get motionData() {
        return this.device.isOpen() ? this.device.motionData : null;
    }

    public get events() {
        return this.eventSubject.asObservable();
    }

    public open() {
        this.device.open();
        return this;
    }

    public isOpen() {
        return this.device.isOpen();
    }

    public close() {
        this.device.close();
        return this;
    }

    public startWatching() {
        this.device.startWatching();
        return this;
    }

    public stopWatching() {
        this.device.stopWatching();
        return this;
    }

    public getDualShockMeta() {
        return this.isOpen() ? this.device.reportToDualshockMeta(this.device.rawReport!, this.id) : null;
    }

    public getDualShockReport() {
        return this.isOpen() ? this.device.reportToDualshockReport(this.device.rawReport!) : null;
    }
}
