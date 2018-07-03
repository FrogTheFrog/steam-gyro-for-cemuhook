import { Observable } from "rxjs";
import { SteamDeviceState } from "../../models/enum/steam-device-state.enum";
import { GenericSteamDeviceEvents } from "../../models/interface/generic-steam-device-events.interface";
import { SteamDeviceReport } from "../../models/interface/steam-device-report.interface";
import { GenericEvent } from "../../models/type/generic-event.type";

// tslint:disable-next-line:no-var-requires
const randomMac = require("random-mac");

export default abstract class GenericSteamDevice {
    public abstract readonly events: Observable<GenericEvent<GenericSteamDeviceEvents>>;
    public abstract open(): this;
    public abstract close(): this;
    public abstract isOpen(): boolean;
    public abstract getReport(previous: boolean): SteamDeviceReport;
}

export function emptySteamDeviceReport() {
    return {
        packetCounter: 0,
        // tslint:disable-next-line:object-literal-sort-keys
        battery: 0,
        timestamp: 0,
        macAddress: randomMac(),
        state: SteamDeviceState.Disconnected,
        button: {
            RT: false,
            // tslint:disable-next-line:object-literal-sort-keys
            LT: false,
            RS: false,
            LS: false,
            Y: false,
            B: false,
            X: false,
            A: false,
            previous: false,
            steam: false,
            next: false,
            dPad: {
                UP: false,
                // tslint:disable-next-line:object-literal-sort-keys
                RIGHT: false,
                LEFT: false,
                DOWN: false,
            },
            grip: {
                LEFT: false,
                RIGHT: false,
            },
            stick: false,
            rightPad: false,
        },
        touch: {
            leftPad: false,
            rightPad: false,
        },
        trigger: {
            LEFT: 0,
            RIGHT: 0,
        },
        position: {
            stick: { x: 0, y: 0 },
            // tslint:disable-next-line:object-literal-sort-keys
            leftPad: { x: 0, y: 0 },
            rightPad: { x: 0, y: 0 },
        },
        accelerometer: {
            x: 0,
            y: 0,
            z: 0,
        },
        gyro: {
            x: 0,
            y: 0,
            z: 0,
        },
        quaternion: {
            x: 0,
            y: 0,
            z: 0,
            // tslint:disable-next-line:object-literal-sort-keys
            w: 0,
        },
    } as SteamDeviceReport;
}
