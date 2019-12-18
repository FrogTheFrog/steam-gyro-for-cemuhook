import { Observable } from "rxjs";
import { MotionDataWithQuaternion, MotionDataWithTimestamp } from "./motion-data.interface";
import { DualshockMeta, DualshockReport } from "./dualshockdata.models";
import { GenericDevice } from "./generic-controller.models";

/**
 * Steam device's connection state.
 */
export const enum SteamDeviceState {
    Disconnected = 0x00,
    Pairing = 0x01,
    Connected = 0x02,
}

/**
 * Steam device report interface.
 */
export interface SteamDeviceReport extends MotionDataWithQuaternion {
    packetCounter: number;
    battery: number;
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
}

/**
 * Abstract class wrapper for Steam devices.
 */
export abstract class GenericSteamDevice extends GenericDevice<SteamDeviceReport>{
    /**
     * Returns observable for new reports.
     */
    public abstract readonly onReport: Observable<SteamDeviceReport>;

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
    public abstract readonly onOpenClose: Observable<boolean>;

    /**
     * Connects to available steam device.
     */
    public abstract async open(): Promise<this>;

    /**
     * Closes open connection to steam device.
     */
    public abstract async close(): Promise<this>;

    /**
     * Check if connection to steam device is open.
     * @returns `true` if connection is open.
     */
    public abstract isOpen(): boolean;

    /**
     * Converts device report to compatible Dualshock device report.
     * @param report Steam device report.
     * @param padId Id to use in new report.
     * @returns Converted report or `null` if conversion failed.
     */
    public abstract reportToDualshockMeta(report: SteamDeviceReport, padId: number): DualshockMeta | null;

    /**
     * Converts device report to compatible Dualshock device metadata.
     * @param report Steam device report.
     * @param padId Id to use in new report.
     * @returns Converted metadata or `null` if conversion failed.
     */
    public abstract reportToDualshockReport(report: SteamDeviceReport): DualshockReport | null;

    /**
     * Returns current report or `null` if there is none.
     */
    public abstract get report(): SteamDeviceReport | null;

    /**
     * Returns current motion data or `null` if there is none.
     */
    public abstract get motionData(): MotionDataWithTimestamp | null;
}

/**
 * Possible HID hardware values.
 */
export const enum SteamHidId {
    Vendor = 0x28DE,
    DongleProduct = 0x1142,
    WiredProduct = 0x1102,
}

/**
 * Scaling values for motion data.
 */
export const enum SteamDeviceScales {
    Accelerometer = 2,
    Gyro = 2000.0,
    Quaternion = 1,
}

/**
 * Ratio values tp multiply motion data by.
 */
export const enum SteamDeviceRatios {
    Accelerometer = SteamDeviceScales.Accelerometer / 32768.0,
    Gyro = SteamDeviceScales.Gyro / 32768.0,
    Quaternion = SteamDeviceScales.Quaternion / 32768.0,
}
