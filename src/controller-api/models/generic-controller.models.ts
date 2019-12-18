import { DualshockMeta, DualshockReport } from "./dualshockdata.models";
import { Observable } from "rxjs";
import { MotionDataWithTimestamp } from "./motion-data.interface";
import { Device as HidDevice, devices as hidDevices, HID } from "node-hid";

/**
 * Possible HID device types.
 */
export type DeviceType = "steam-dongle" | "steam-wired" | "ds4-bluetooth" | "ds4-wired";

/**
 * Interface for storing HID device info.
 */
export interface DeviceInfo {
    info: HidDevice;
    type: DeviceType;
    active: boolean;
    path: string;
}

/**
 * Abstract class wrapper for controller devices.
 */

 export abstract class GenericDevice <R extends MotionDataWithTimestamp> {

    public abstract hidHandle: HID | null;

    public abstract deviceInfo: DeviceInfo;

    public abstract readonly deviceType: string;
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
    public abstract readonly onOpenClose: Observable<boolean>;

    /**
     * Connects to available device.
     */
    public abstract async open(): Promise<this>;

    /**
     * Closes open connection to device.
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
    public abstract reportToDualshockMeta(report: R, padId: number): DualshockMeta | null;

    /**
     * Converts device report to compatible Dualshock device metadata.
     * @param report Steam device report.
     * @param padId Id to use in new report.
     * @returns Converted metadata or `null` if conversion failed.
     */
    public abstract reportToDualshockReport(report: R): DualshockReport | null;

    /**
     * Returns current report or `null` if there is none.
     */
    public abstract get report(): R | null;

    /**
     * Returns current motion data or `null` if there is none.
     */
    public abstract get motionData(): MotionDataWithTimestamp | null;
}

