import { DualshockEvents } from "./dualshock-events.interface";
import { SteamDeviceReport } from "./steam-device-report.interface";

export interface SteamControllerEvents extends DualshockEvents {
    report: SteamDeviceReport;
}
