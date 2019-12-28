import * as long from "long";
import { Observable } from "rxjs";
import { MotionData, MotionDataWithTimestamp, TypedFilterData } from "../../shared/models";

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
    Charged = 0xEF,
}

/**
 * Dualshock connection type.
 */
export const enum DualshockConnection {
    None = 0x00,
    Usb = 0x01,
    Bluetooth = 0x02,
}

/**
 * Dualshock model type.
 */
export const enum DualshockModel {
    None = 0,
    DS3 = 1,
    DS4 = 2,
    Generic = 3,
}

/**
 * Dualshock connection status.
 */
export const enum DualshockState {
    Disconnected = 0x00,
    Reserved = 0x01,
    Connected = 0x02,
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
export interface DualshockReport extends MotionData {
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

/**
 * Interface for dualshock report + metadata object.
 */
export interface DualshockData {
    report: DualshockReport;
    meta: DualshockMeta;
}

/**
 * Abstract class wrapper for Dualshock devices.
 */
export abstract class GenericDualshockController<R = object> {
    /**
     * Returns observable for new dualshock data.
     */
    public abstract readonly onDualshockData: Observable<DualshockData>;

    /**
     * Returns observable for new reports.
     */
    public abstract readonly onReport: Observable<R>;

    /**
     * Returns observable for new motion data.
     */
    public abstract readonly onMotionsData: Observable<MotionDataWithTimestamp>;

    /**
     * Returns observable for errors.
     */
    public abstract readonly onError: Observable<Error>;

    /**
     * Returns observable for open and close events.
     */
    public abstract readonly onOpenClose: Observable<{ info: string, status: boolean }>;

    /**
     * Returns string containing information about device.
     */
    public abstract readonly infoString: string | null;

    /**
     * Connects to available steam device.
     */
    public abstract open(): this;

    /**
     * Closes open connection to steam device.
     */
    public abstract close(): this;

    /**
     * Check if connection to steam device is open.
     * @returns `true` if connection is open.
     */
    public abstract isOpen(): boolean;

    /**
     * Sets filter to be used on **report** for motion data **before** emitting said report.
     */
    public abstract setFilter(data: TypedFilterData): void;

    /**
     * Returns Dualshock compatible metadata or `null` if it cannot be retrieved.
     */
    public abstract get dualShockMeta(): DualshockMeta | null;

    /**
     * Returns Dualshock compatible report or `null` if it cannot be retrieved.
     */
    public abstract get dualShockReport(): DualshockReport | null;

    /**
     * Returns actual device report or `null` if it cannot be retrieved.
     */
    public abstract get report(): object | null;

    /**
     * Returns motion data or `null` if it cannot be retrieved.
     */
    public abstract get motionData(): MotionDataWithTimestamp | null;
}
