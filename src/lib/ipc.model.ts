import { ipcMain as e_ipcMain, ipcRenderer as e_ipcRenderer } from 'electron';
import { NonfatalError } from './error.model';
import { userSettings } from './settings.model';
import { SteamDevice } from './steam-device';
import { SteamController } from './steam-controller';
import { TypedIpcMain, TypedIpcRenderer } from './typed-ipc';

export interface FromRenderer {
    angularLoaded: void
    nonfatalError: NonfatalError,
    restartServer: void,
    getUserSettings: void,
    saveUserSettings: userSettings.Type,
    updateServer: userSettings.Type['server'],
    toggleSilentErrors: userSettings.Type['silentErrors'],
    getSteamDevices: void,
    closeSteamDevice: void,
    openSteamDevice: string,
    startDataSteam: void,
    stopDataSteam: void
}

export interface ToRenderer {
    nonfatalError: NonfatalError,
    userSettings: userSettings.Type,
    steamDevices: SteamDevice.Item[],
    deviceChanged: SteamDevice.Item[],
    dataStream: SteamController.Report
}

export const ipcMain: TypedIpcMain<FromRenderer, ToRenderer> = e_ipcMain;
export const ipcRenderer: TypedIpcRenderer<ToRenderer, FromRenderer> = e_ipcRenderer;