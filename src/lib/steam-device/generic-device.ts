import { Observable } from "rxjs";
import { DualshockMeta } from "../../models/interface/dualshock-meta.interface";
import { DualshockReport } from "../../models/interface/dualshock-report.interface";
import { GenericDeviceEvents } from "../../models/interface/generic-device-events.interface";
import { MotionData } from "../../models/interface/motion-data.interface";
import { SteamDeviceReport } from "../../models/interface/steam-device-report.interface";
import { GenericEvent } from "../../models/type/generic-event.type";

export default abstract class GenericDevice {
    public abstract readonly events: Observable<GenericEvent<GenericDeviceEvents>>;
    public abstract open(): this;
    public abstract close(): this;
    public abstract isOpen(): boolean;
    public abstract reportToDualshockMeta(report: SteamDeviceReport, padId: number): DualshockMeta | null;
    public abstract reportToDualshockReport(report: SteamDeviceReport): DualshockReport | null;
    public abstract get rawReport(): SteamDeviceReport | null;
    public abstract get motionData(): MotionData | null;
}
