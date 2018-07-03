import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { UserSettings } from "../../../../models/interface/user-settings.interface";
import { IpcService } from "../../../core/services/ipc.service";

@Injectable()
export class SettingsService {
    private currentsSettings: UserSettings | null = null;
    private settingsSubject = new Subject<UserSettings>();

    constructor(private ipc: IpcService) {
        this.ipc.on("userSettings", (data) => {
            this.currentsSettings = data;
            this.settingsSubject.next(data);
        });
    }

    get value() {
        return this.currentsSettings;
    }

    get observe() {
        return this.settingsSubject.asObservable();
    }
}
