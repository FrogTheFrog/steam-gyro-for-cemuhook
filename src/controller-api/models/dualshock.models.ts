import { Observable } from "rxjs";
import { MotionDataWithTimestamp } from "./motion-data.interface";
import { TypedFilterData } from "./filter.models";
import { GenericDevice } from "./generic-controller.models";
import { DualshockReport, DualshockData, DualshockMeta } from "./dualshockdata.models";

/**
 * Abstract class wrapper for Dualshock devices.
 */
export abstract class GenericDualshockDevice extends GenericDevice<DualshockReport> {
    /**
     * Returns observable for new dualshock data.
     */
    public abstract readonly onDualshockData: Observable<DualshockData>;

    /**
     * Returns observable for new reports.
     */
    public abstract readonly onReport: Observable<DualshockReport>;

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
    public abstract get report(): DualshockReport | null;

    /**
     * Returns motion data or `null` if it cannot be retrieved.
     */
    public abstract get motionData(): MotionDataWithTimestamp | null;
}
