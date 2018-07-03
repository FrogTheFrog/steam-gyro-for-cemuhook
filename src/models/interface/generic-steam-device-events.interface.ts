import { SteamDeviceReport } from "./steam-device-report.interface";

export interface GenericSteamDeviceEvents {
    "report": SteamDeviceReport;
    "error": Error;
    "close": void;
}
