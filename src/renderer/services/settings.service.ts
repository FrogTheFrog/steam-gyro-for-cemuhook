import { Injectable } from '@angular/core';
import { ipcRenderer } from "electron";
import { userSettings } from "../../lib/settings.model";
import { Subject } from 'rxjs';

@Injectable()
export class SettingsService {
    private userSettings = new Subject<userSettings.type>();
    private retrievingData: boolean = false;

    constructor() {
        ipcRenderer.on('userSettingsResp', (event: Event, settings: userSettings.type) => {
            if (settings === undefined) {
                setTimeout(() => {
                    ipcRenderer.send('userSettingsReq');
                }, 500);
            }
            else {
                this.retrievingData = false;
                this.userSettings.next(settings);
            }
        })
    }

    get settings() {
        if (!this.retrievingData) {
            this.retrievingData = true;
            ipcRenderer.send('userSettingsReq');
        }

        return this.userSettings.asObservable();
    }

    updateSettings() {
        if (!this.retrievingData) {
            this.retrievingData = true;
            ipcRenderer.send('userSettingsReq');
        }
    }
}