import { Injectable } from '@angular/core';
import { remote, BrowserWindow } from 'electron';
import { Subject } from 'rxjs';
import { ErrorService } from './error.service';

@Injectable()
export class WindowService {
    private currentWindow: BrowserWindow = remote.getCurrentWindow();
    private eventHandler: Subject<'show' | 'hide' | 'maximize' | 'unmaximize'> = new Subject();

    constructor(private errorService: ErrorService) {
        this.currentWindow.on('show', () => {
            this.eventHandler.next('show');
        }).on('hide', () => {
            this.eventHandler.next('hide');
        }).on('maximize', () => {
            this.eventHandler.next('maximize');
        }).on('unmaximize', () => {
            this.eventHandler.next('unmaximize');
        });
    }

    hide() {
        this.currentWindow.close();
    }

    get window() {
        return this.currentWindow;
    }

    get events() {
        return this.eventHandler.asObservable();
    }
}