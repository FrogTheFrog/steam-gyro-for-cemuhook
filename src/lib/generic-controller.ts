import * as long from "long";
import * as microtime from "microtime";
import { Subject } from "rxjs";
import { DualshockBattery } from "../models/enum/dualshock-battery.enum";
import { DualshockConnection } from "../models/enum/dualshock-connection.enum";
import { DualshockModel } from "../models/enum/dualshock-model.enum";
import { DualshockState } from "../models/enum/dualshock-state.enum";
import { SteamDeviceState } from "../models/enum/steam-device-state.enum";
import { DualshockMeta } from "../models/interface/dualshock-meta.interface";
import { DualshockReport } from "../models/interface/dualshock-report.interface";
import { SteamControllerEvents } from "../models/interface/steam-controller-events.interface";
import { SteamDeviceReport } from "../models/interface/steam-device-report.interface";
import { GenericEvent } from "../models/type/generic-event.type";
import { DualshockGenericController } from "./dualshock-generic-controller";
import SteamDevice from "./steam-device/steam-device";

export default class GenericController extends DualshockGenericController {
    private steamDevice: SteamDevice = new SteamDevice();
    private eventSubject = new Subject<GenericEvent<SteamControllerEvents>>();

    constructor(private id: number) {
        super();
        this.steamDevice.events.subscribe((data) => {
            switch (data.event) {
                case "report":
                    this.eventSubject.next({
                        event: "dualshockData",
                        value: {
                            meta: this.reportToDualshockMeta(data.value),
                            report: this.reportToDualshockReport(data.value),
                        },
                    });
                    this.eventSubject.next({
                        event: "report",
                        value: data.value,
                    });
                    break;
                case "error":
                    this.eventSubject.next(data);
                    break;
                default:
                    break;
            }
        });
    }

    get events() {
        return this.eventSubject.asObservable();
    }

    public open() {
        this.steamDevice.open();
        return this;
    }

    public isOpen() {
        return this.steamDevice.isOpen();
    }

    public close() {
        this.steamDevice.close();
        return this;
    }

    public startWatching() {
        this.steamDevice.startWatching();
        return this;
    }

    public stopWatching() {
        this.steamDevice.stopWatching();
        return this;
    }

    public getDualShockMeta() {
        return this.isOpen() ? this.reportToDualshockMeta(this.steamDevice.getReport()!) : null;
    }

    public getDualShockReport() {
        return this.isOpen() ? this.reportToDualshockReport(this.steamDevice.getReport()!) : null;
    }

    private toDualshockPosition(int16Value: number) {
        return Math.floor((int16Value + 32768) * 255 / 65535);
    }

    private reportToDualshockReport(report: SteamDeviceReport): DualshockReport {
        return {
            packetCounter: report.packetCounter,
            // tslint:disable-next-line:object-literal-sort-keys
            motionTimestamp: long.fromNumber(report.timestamp, true),
            button: {
                R1: report.button.RS,
                // tslint:disable-next-line:object-literal-sort-keys
                L1: report.button.LS,
                R2: report.button.RT,
                L2: report.button.LT,
                R3: report.button.rightPad,
                L3: report.button.stick,
                PS: report.button.steam,
                SQUARE: report.button.X,
                CROSS: report.button.A,
                CIRCLE: report.button.B,
                TRIANGLE: report.button.Y,
                options: report.button.next,
                share: report.button.previous,
                dPad: {
                    UP: report.button.dPad.UP,
                    // tslint:disable-next-line:object-literal-sort-keys
                    RIGHT: report.button.dPad.RIGHT,
                    LEFT: report.button.dPad.LEFT,
                    DOWN: report.button.dPad.DOWN,
                },
                touch: false,
            },
            position: {
                left: {
                    x: this.toDualshockPosition(report.position.stick.x),
                    y: this.toDualshockPosition(report.position.stick.y),
                },
                right: {
                    x: this.toDualshockPosition(report.position.rightPad.x),
                    y: this.toDualshockPosition(report.position.rightPad.y),
                },
            },
            trigger: {
                R2: report.trigger.LEFT,
                // tslint:disable-next-line:object-literal-sort-keys
                L2: report.trigger.RIGHT,
            },
            accelerometer: {
                x: -report.accelerometer.x,
                y: -report.accelerometer.z,
                z: report.accelerometer.y,
            },
            gyro: {
                x: report.gyro.x,
                y: -report.gyro.z,
                z: -report.gyro.y,
            },
            trackPad: {
                first: {
                    isActive: false,
                    // tslint:disable-next-line:object-literal-sort-keys
                    id: 0,
                    x: 0,
                    y: 0,
                },
                second: {
                    isActive: false,
                    // tslint:disable-next-line:object-literal-sort-keys
                    id: 0,
                    x: 0,
                    y: 0,
                },
            },
        };
    }

    private reportToDualshockMeta(report: SteamDeviceReport): DualshockMeta {
        return {
            batteryStatus: DualshockBattery.None,
            connectionType: DualshockConnection.Usb,
            isActive: microtime.now() - report.timestamp < 1000000,
            macAddress: report.macAddress,
            model: DualshockModel.DS4,
            padId: this.id,
            state: report.state === SteamDeviceState.Connected
                ? DualshockState.Connected : DualshockState.Disconnected,
        };
    }
}
