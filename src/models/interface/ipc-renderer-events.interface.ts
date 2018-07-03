import { SteamDeviceReport } from "./steam-device-report.interface";
import { UserSettings } from "./user-settings.interface";

export interface IpcRendererEvents {
    error: Error;
    userSettings: UserSettings;
    dataStream: SteamDeviceReport;
}
