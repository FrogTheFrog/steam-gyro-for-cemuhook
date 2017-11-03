import { Injectable } from '@angular/core';
import { ipcRenderer } from "electron";
import { SteamDevice } from "../../lib/steam-device";
import { SteamController } from "../../lib/steam-controller";
import { Subject, BehaviorSubject } from 'rxjs';
import * as _ from 'lodash';

@Injectable()
export class SteamDevicesService {
    private steamItems = new BehaviorSubject<SteamDevice.Item[]>([]);
    private deviceDataStream = new Subject<SteamController.Report>();
    private deviceChanged = new Subject<void>();
    private retrievingData: boolean = false;

    constructor() {
        ipcRenderer.on('steamDevicesResp', (event: Event, items: SteamDevice.Item[]) => {
            this.retrievingData = false;
            if (!_.isEqual(this.steamItems.getValue(), items))
                this.steamItems.next(items);
        }).on('deviceChanged', (event: Event, items: SteamDevice.Item[]) => {
            this.deviceChanged.next();
            if (!this.retrievingData && !_.isEqual(this.steamItems.getValue(), items))
                this.steamItems.next(items);
        }).on('dataStream', (event: Event, data: SteamController.Report) => {
            this.deviceDataStream.next(data);
        });
    }

    get items() {
        return this.steamItems.asObservable();
    }

    get changed() {
        return this.deviceChanged.asObservable();
    }

    get dataStream() {
        return this.deviceDataStream.asObservable();
    }

    updateItems() {
        if (!this.retrievingData) {
            this.retrievingData = true;
            ipcRenderer.send('steamDevicesReq');
        }
    }
}