import { SteamDeviceReport } from "./steam-device-report.interface";

export interface SteamDeviceEvents {
    "report": SteamDeviceReport;
    "error": Error;
    "close": void;
}
