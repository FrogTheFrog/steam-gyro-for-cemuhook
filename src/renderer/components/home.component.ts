import { Component, ChangeDetectionStrategy } from '@angular/core';
const jsonPackage = require('../../../package.json');

@Component({
    selector: 'home',
    template: `
        <mat-card>
            <mat-card-header>
                <div mat-card-avatar class="icon"></div>
                <mat-card-title>App version:</mat-card-title>
                <mat-card-subtitle>{{appVersion}}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
                <h3>Editing app settings</h3>
                <p class="secondary">
                    Unless specified otherwise, settings will be refreshed in real time without the need of restarting server.
                </p>
                <h3>Steam devices</h3>
                <p class="secondary">
                    Check what Steam devices were found and are in use.<br>
                    Useful if something is not working and you have no idea where to start.
                </p>
            </mat-card-content>
        </mat-card>
    `,
    styleUrls: ['../styles/home.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent { 
    private appVersion: string;

    constructor(){
        this.appVersion = jsonPackage.version;
    }
}