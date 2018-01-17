import { Injectable } from '@angular/core';
import { ipcRenderer } from "./../../lib/ipc.model";
import { userSettings } from "../../lib/settings.model";
import { Subject } from 'rxjs';

@Injectable()
export class SettingsService {
    private userSettings = new Subject<userSettings.Type>();
    private retrievingData: boolean = false;

    constructor() {
        ipcRenderer.on('userSettings', (event, settings) => {
            if (settings === undefined) {
                setTimeout(() => {
                    ipcRenderer.send('getUserSettings', void 0);
                }, 500);
            }
            else {
                this.retrievingData = false;
                this.userSettings.next(settings);
            }
        });
    }

    get settings() {
        if (!this.retrievingData) {
            this.retrievingData = true;
            ipcRenderer.send('getUserSettings', void 0);
        }

        return this.userSettings.asObservable();
    }

    updateSettings() {
        if (!this.retrievingData) {
            this.retrievingData = true;
            ipcRenderer.send('getUserSettings', void 0);
        }
    }
}