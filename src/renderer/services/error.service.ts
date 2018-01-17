import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { ipcRenderer } from "./../../lib/ipc.model";
import { NonfatalError } from '../../lib/error.model';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class ErrorService {
    private latestError = new BehaviorSubject<NonfatalError>(undefined);

    constructor(private router: Router, private ngZone: NgZone) {
        ipcRenderer.on('nonfatalError', (event, error) => {
            this.ngZone.run(() => {
                this.logError(error);
            });
        });
    }

    get error() {
        return this.latestError.asObservable();
    }

    logError(error: NonfatalError, show: boolean = true) {
        this.latestError.next(error);
        ipcRenderer.send('nonfatalError', error);

        if (show)
            this.router.navigateByUrl('/error');
    }
}