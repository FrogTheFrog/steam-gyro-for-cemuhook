import * as long from "long";
import { MotionDataWithTimestamp } from "./motion-data.interface";
/**
 * Dualshock battery status.
 */
export const enum DualshockBattery {
    None = 0x00,
    Dying = 0x01,
    Low = 0x02,
    Medium = 0x03,
    High = 0x04,
    Full = 0x05,
    Charging = 0xEE,
    Charged = 0xEF
}
/**
 * Dualshock connection type.
 */
export const enum DualshockConnection {
    None = 0x00,
    Usb = 0x01,
    Bluetooth = 0x02
}
/**
 * Dualshock model type.
 */
export const enum DualshockModel {
    None = 0,
    DS3 = 1,
    DS4 = 2,
    Generic = 3
}
/**
 * Dualshock connection status.
 */
export const enum DualshockState {
    Disconnected = 0x00,
    Reserved = 0x01,
    Connected = 0x02
}
/**
 * Dualshock metadata interface.
 */
export interface DualshockMeta {
    padId: number;
    state: DualshockState;
    connectionType: DualshockConnection;
    model: DualshockModel;
    macAddress: string;
    batteryStatus: DualshockBattery;
    isActive: boolean;
}
/**
 * Dualshock report interface.
 */
export interface DualshockReport extends MotionDataWithTimestamp {
    packetCounter: number;
    motionTimestamp: long;
    button: {
        R1: boolean;
        L1: boolean;
        R2: boolean;
        L2: boolean;
        R3: boolean;
        L3: boolean;
        PS: boolean;
        SQUARE: boolean;
        CROSS: boolean;
        CIRCLE: boolean;
        TRIANGLE: boolean;
        options: boolean;
        share: boolean;
        dPad: {
            UP: boolean;
            RIGHT: boolean;
            LEFT: boolean;
            DOWN: boolean;
        };
        touch: boolean;
    };
    position: {
        left: {
            x: number;
            y: number;
        };
        right: {
            x: number;
            y: number;
        };
    };
    trigger: {
        L2: number;
        R2: number;
    };
    trackPad: {
        first: {
            isActive: boolean;
            id: number;
            x: number;
            y: number;
        };
        second: {
            isActive: boolean;
            id: number;
            x: number;
            y: number;
        };
    };
}
/**
 * Interface for dualshock report + metadata object.
 */
export interface DualshockData {
    report: DualshockReport;
    meta: DualshockMeta;
}
