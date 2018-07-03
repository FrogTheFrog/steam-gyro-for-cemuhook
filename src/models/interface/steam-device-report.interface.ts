import { SteamDeviceState } from "../enum/steam-device-state.enum";

export interface SteamDeviceReport {
    packetCounter: number;
    battery: number;
    timestamp: number;
    macAddress: string;
    state: SteamDeviceState;
    button: {
        RT: boolean,
        LT: boolean,
        RS: boolean,
        LS: boolean,
        Y: boolean,
        B: boolean,
        X: boolean,
        A: boolean,
        previous: boolean,
        steam: boolean,
        next: boolean,
        dPad: {
            UP: boolean,
            RIGHT: boolean,
            LEFT: boolean,
            DOWN: boolean,
        },
        grip: {
            LEFT: boolean,
            RIGHT: boolean,
        },
        stick: boolean,
        rightPad: boolean,
    };
    touch: {
        leftPad: boolean,
        rightPad: boolean,
    };
    trigger: {
        LEFT: number,
        RIGHT: number,
    };
    position: {
        stick: { x: number, y: number },
        leftPad: { x: number, y: number },
        rightPad: { x: number, y: number },
    };
    accelerometer: {
        x: number,
        y: number,
        z: number,
    };
    gyro: {
        x: number,
        y: number,
        z: number,
    };
    quaternion: {
        x: number,
        y: number,
        z: number,
        w: number,
    };
}
