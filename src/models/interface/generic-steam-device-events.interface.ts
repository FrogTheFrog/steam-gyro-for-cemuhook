import { MotionData } from "./motion-data.interface";
import { SteamDeviceReport } from "./steam-device-report.interface";

export interface GenericSteamDeviceEvents {
    "report": SteamDeviceReport;
    "motionData": MotionData;
    "error": Error;
    "close": void;
}
