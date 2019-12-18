import { SteamDeviceReport, SteamDeviceScales, SteamDeviceState } from "../models";

// tslint:disable-next-line:no-var-requires
const randomMac = require("random-mac");

export function emptySteamDeviceReport(): SteamDeviceReport {
    // tslint:disable:object-literal-sort-keys
    return {
        packetCounter: 0,
        battery: 0,
        timestamp: 0,
        macAddress: randomMac(),
        state: SteamDeviceState.Disconnected,
        button: {
            RT: false,
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
            leftPad: { x: 0, y: 0 },
            rightPad: { x: 0, y: 0 },
        },
        accelerometer: {
            x: 0,
            y: 0,
            z: 0,
            range: [-SteamDeviceScales.Accelerometer, SteamDeviceScales.Accelerometer],
        },
        gyro: {
            x: 0,
            y: 0,
            z: 0,
            range: [-SteamDeviceScales.Gyro, SteamDeviceScales.Gyro],
        },
        quaternion: {
            x: 0,
            y: 0,
            z: 0,
            w: 0,
            range: [-SteamDeviceScales.Quaternion, SteamDeviceScales.Quaternion],
        },
    };
    // tslint:enable:object-literal-sort-keys
}
