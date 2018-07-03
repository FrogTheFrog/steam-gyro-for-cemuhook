import * as long from "long";

export interface DualshockReport {
    packetCounter: number;
    motionTimestamp: long;
    button: {
        R1: boolean,
        L1: boolean,
        R2: boolean,
        L2: boolean,
        R3: boolean,
        L3: boolean,
        PS: boolean,
        SQUARE: boolean,
        CROSS: boolean,
        CIRCLE: boolean,
        TRIANGLE: boolean,
        options: boolean,
        share: boolean,
        dPad: {
            UP: boolean,
            RIGHT: boolean,
            LEFT: boolean,
            DOWN: boolean,
        },
        touch: boolean,
    };
    position: {
        left: { x: number, y: number },
        right: { x: number, y: number },
    };
    trigger: {
        L2: number,
        R2: number,
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
    trackPad: {
        first: {
            isActive: boolean,
            id: number,
            x: number,
            y: number,
        },
        second: {
            isActive: boolean,
            id: number,
            x: number,
            y: number,
        },
    };
}
