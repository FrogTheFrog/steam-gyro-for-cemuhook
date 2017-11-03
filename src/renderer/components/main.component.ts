import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, Renderer2, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/platform-browser';
import { remote, ipcRenderer, BrowserWindow } from 'electron';
import { WindowService } from '../services';
import { Subscription } from 'rxjs';

@Component({
    selector: 'main',
    template: `
        <mat-toolbar>
            <a mat-button routerLink="/">Steam Gyro For Cemuhook</a>
            <a mat-button routerLink="/settings">Settings</a>
            <a mat-button routerLink="/steam-devices">Steam devices</a>
            <span class="fill-remaining-space"></span>
            <button mat-button (click)="hide()">Hide</button>
        </mat-toolbar>
        <router-outlet style="display: none;"></router-outlet>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    styleUrls: ['../styles/main.component.scss']
})
export class MainComponent implements OnInit, OnDestroy {
    private currentWindow: BrowserWindow = remote.getCurrentWindow();
    private subscription: Subscription = new Subscription();

    constructor(private windowService: WindowService, private renderer: Renderer2, @Inject(DOCUMENT) private document: Document) { }

    private hide() {
        this.windowService.hide();
    }

    ngOnInit() {
        this.subscription.add(this.windowService.events.subscribe((event) => {
            if (event === 'maximize') {
                this.renderer.removeClass(this.document.body, 'window-resize-border');
            }
            else if (event === 'unmaximize') {
                this.renderer.addClass(this.document.body, 'window-resize-border');
            }
        }));

        if (!this.windowService.window.isMaximized())
            this.renderer.addClass(this.document.body, 'window-resize-border');

        ipcRenderer.send('angular-loaded');
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}