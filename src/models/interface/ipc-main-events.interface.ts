import { UserSettings } from "./user-settings.interface";

export interface IpcMainEvents {
    angularLoaded: void;
    error: Error;
    restartServer: void;
    getUserSettings: void;
    saveUserSettings: UserSettings;
    updateServer: UserSettings["server"];
    getSteamDevices: void;
    closeSteamDevice: void;
    openSteamDevice: string;
    startDataSteam: void;
    stopDataSteam: void;
}
