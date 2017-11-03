import { WindowService } from '../services/window.service';
import { SteamDevicesService } from '../services/steam-devices.service';
import { Component, ChangeDetectionStrategy, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { DataSource } from '@angular/cdk/collections';
import { SteamDevice } from '../../lib/steam-device';
import { ipcRenderer } from "electron";
import { Subscription } from 'rxjs';
import { SteamController } from "../../lib/steam-controller";

@Component({
    selector: 'steam-devices',
    template: `
        <div class="container">
            <ng-container *ngIf="itemData.length > 0; else noData">
                <div class="mat-table">
                    <div class="mat-header-row">
                        <div class="mat-header-cell">Product name</div>
                        <div class="mat-header-cell">Vendor ID</div>
                        <div class="mat-header-cell">Product ID</div>
                        <div class="mat-header-cell">Usage page</div>
                        <div class="mat-header-cell">Type</div>
                        <div class="mat-header-cell">Wireless status</div>
                        <div class="mat-header-cell">Data stream</div>
                    </div>
                    <ng-container *ngFor="let item of itemData">
                        <div class="mat-row">
                            <div class="mat-cell">{{item.info.product}}</div>
                            <div class="mat-cell">{{item.info.vendorId}}</div>
                            <div class="mat-cell">{{item.info.productId}}</div>
                            <div class="mat-cell">{{item.info.usagePage}}</div>
                            <div class="mat-cell">{{item.type === 'wired' ? 'Wired' : (item.type === null ? '-' : 'Wireless')}}</div>
                            <div class="mat-cell">{{item.type === 'wirelessConnected' ? 'On' : (item.type === 'wirelessDisconnected' ? 'Off' : '-')}}</div>
                            <div class="mat-cell">
                                <ng-container [ngSwitch]="item.inUse">
                                    <ng-container *ngSwitchCase="true">
                                        <button mat-raised-button (click)="closeDevice()" color="warn" [disabled]="waitForChange">Close</button>
                                    </ng-container>
                                    <ng-container *ngSwitchCase="false">
                                        <button mat-raised-button (click)="openDevice(item.info.path)" color="accent" [disabled]="waitForChange">Open</button>
                                    </ng-container>
                                    <ng-container *ngSwitchDefault>
                                        <button mat-raised-button disabled>Open</button>
                                    </ng-container>
                                </ng-container>
                            </div>
                        </div>
                        <div class="mat-row info-row" *ngIf="item.inUse === true">
                            <div class="group general">
                                <div class="title">General</div>
                                <div class="items">
                                    <div class="name">Packet counter:</div><div class="data">{{dataStream.packetCounter}}</div>
                                    <div class="name">Battery:</div><div class="data">{{dataStream.battery}}</div>
                                    <div class="name">Timestamp:</div><div class="data">{{dataStream.timestamp}}</div>
                                    <div class="name">Mac address:</div><div class="data">{{dataStream.macAddress}}</div>
                                    <div class="name">State:</div><div class="data">{{dataStream.state === 0 ? 'disconnected' : (dataStream.state === 2 ? 'connected' : 'pairing')}}</div>
                                </div>
                            </div>
                            <div class="group buttons">
                                <div class="title">Buttons</div>
                                <div class="items">
                                    <div class="name">RT:</div><div class="data">{{dataStream.button.RT}}</div>
                                    <div class="name">LT:</div><div class="data">{{dataStream.button.LT}}</div>
                                    <div class="name">RS:</div><div class="data">{{dataStream.button.RS}}</div>
                                    <div class="name">LS:</div><div class="data">{{dataStream.button.LS}}</div>
                                    <div class="name">Y:</div><div class="data">{{dataStream.button.Y}}</div>
                                    <div class="name">B:</div><div class="data">{{dataStream.button.B}}</div>
                                    <div class="name">X:</div><div class="data">{{dataStream.button.X}}</div>
                                    <div class="name">A:</div><div class="data">{{dataStream.button.A}}</div>
                                    <div class="name">Previous:</div><div class="data">{{dataStream.button.previous}}</div>
                                    <div class="name">Steam:</div><div class="data">{{dataStream.button.steam}}</div>
                                    <div class="name">Next:</div><div class="data">{{dataStream.button.next}}</div>
                                    <div class="name">Stick:</div><div class="data">{{dataStream.button.stick}}</div>
                                    <div class="name">Right pad:</div><div class="data">{{dataStream.button.rightPad}}</div>
                                </div>
                            </div>
                            <div class="group dpad">
                                <div class="title">D-pad</div>
                                <div class="items">
                                    <div class="name">Up:</div><div class="data">{{dataStream.button.dPad.UP}}</div>
                                    <div class="name">Right:</div><div class="data">{{dataStream.button.dPad.RIGHT}}</div>
                                    <div class="name">Left:</div><div class="data">{{dataStream.button.dPad.LEFT}}</div>
                                    <div class="name">Down:</div><div class="data">{{dataStream.button.dPad.DOWN}}</div>
                                </div>
                            </div>
                            <div class="group grip">
                                <div class="title">Grip</div>
                                <div class="items">
                                    <div class="name">Left:</div><div class="data">{{dataStream.button.grip.LEFT}}</div>
                                    <div class="name">Right:</div><div class="data">{{dataStream.button.grip.RIGHT}}</div>
                                </div>
                            </div>
                            <div class="group touch">
                                <div class="title">Touch</div>
                                <div class="items">
                                    <div class="name">Left pad:</div><div class="data">{{dataStream.touch.leftPad}}</div>
                                    <div class="name">Right pad:</div><div class="data">{{dataStream.touch.rightPad}}</div>
                                </div>
                            </div>
                            <div class="group trigger">
                                <div class="title">Trigger</div>
                                <div class="items">
                                    <div class="name">LT:</div><div class="data">{{dataStream.trigger.LEFT}}</div>
                                    <div class="name">RT:</div><div class="data">{{dataStream.trigger.RIGHT}}</div>
                                </div>
                            </div>
                            <div class="group stick">
                                <div class="title">Stick position</div>
                                <div class="items">
                                    <div class="name">X:</div><div class="data">{{dataStream.position.stick.x}}</div>
                                    <div class="name">Y:</div><div class="data">{{dataStream.position.stick.y}}</div>
                                </div>
                            </div>
                            <div class="group lpad">
                                <div class="title">L-pad position</div>
                                <div class="items">
                                    <div class="name">X:</div><div class="data">{{dataStream.position.leftPad.x}}</div>
                                    <div class="name">Y:</div><div class="data">{{dataStream.position.leftPad.y}}</div>
                                </div>
                            </div>
                            <div class="group rpad">
                                <div class="title">R-pad position</div>
                                <div class="items">
                                    <div class="name">X:</div><div class="data">{{dataStream.position.rightPad.x}}</div>
                                    <div class="name">Y:</div><div class="data">{{dataStream.position.rightPad.y}}</div>
                                </div>
                            </div>
                            <div class="group accelerometer">
                                <div class="title">Accelerometer</div>
                                <div class="items">
                                    <div class="name">X:</div><div class="data">{{dataStream.accelerometer.x | number : '1.3-3'}}</div>
                                    <div class="name">Y:</div><div class="data">{{dataStream.accelerometer.y | number : '1.3-3'}}</div>
                                    <div class="name">Z:</div><div class="data">{{dataStream.accelerometer.z | number : '1.3-3'}}</div>
                                </div>
                            </div>
                            <div class="group gyro">
                                <div class="title">Gyroscope</div>
                                <div class="items">
                                    <div class="name">X:</div><div class="data">{{dataStream.gyro.x | number : '1.3-3'}}</div>
                                    <div class="name">Y:</div><div class="data">{{dataStream.gyro.y | number : '1.3-3'}}</div>
                                    <div class="name">Z:</div><div class="data">{{dataStream.gyro.z | number : '1.3-3'}}</div>
                                </div>
                            </div>
                            <div class="group quaternion">
                                <div class="title">Quaternion</div>
                                <div class="items">
                                    <div class="name">X:</div><div class="data">{{dataStream.quaternion.x | number : '1.3-3'}}</div>
                                    <div class="name">Y:</div><div class="data">{{dataStream.quaternion.y | number : '1.3-3'}}</div>
                                    <div class="name">Z:</div><div class="data">{{dataStream.quaternion.z | number : '1.3-3'}}</div>
                                    <div class="name">W:</div><div class="data">{{dataStream.quaternion.w | number : '1.3-3'}}</div>
                                </div>
                            </div>
                            <div class="group info">
                                <div class="title">Report data</div>
                                <div class="items">
                                    <div class="name">
                                        Data shown in this grid, besides MAC and a few accelerometer and gyroscope modifications, is being read directly from Steam Controller.
                                        Use it for debugging purposes.
                                    </div><div class="data"></div>
                                </div>
                            </div>
                        </div>
                    </ng-container>
                </div>
            </ng-container>
            <ng-template #noData>
                <mat-spinner></mat-spinner>            
            </ng-template>
        </div>
    `,
    styleUrls: ['../styles/steam-devices.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SteamDevicesComponent implements OnInit, OnDestroy {
    private intervalTimer: NodeJS.Timer = undefined;
    private waitForChange: boolean = false;
    private subscription: Subscription = new Subscription();
    private itemData: SteamDevice.Item[] = [];
    private dataStream: SteamController.Report = SteamController.emptySteamControllerReport();

    constructor(private steamDevicesService: SteamDevicesService, private windowService: WindowService, private changeDetectorRef: ChangeDetectorRef) { }

    ngOnInit() {
        this.subscription.add(this.steamDevicesService.changed.subscribe(() => this.waitForChange = false));
        this.subscription.add(this.steamDevicesService.items.subscribe((data) => {
            this.itemData = data;
            this.changeDetectorRef.detectChanges();
        }));
        this.subscription.add(this.steamDevicesService.dataStream.subscribe((data) => {
            this.dataStream = data;
            this.changeDetectorRef.detectChanges();
        }));
        this.subscription.add(this.windowService.events.subscribe((event) => {
            if (event === 'show') {
                this.startTimer();
                this.startDataStream();
            }
            else if (event === 'hide') {
                this.stopTimer();
                this.stopDataStream();
            }
        }));
        this.startTimer();
        this.startDataStream();
    }

    ngOnDestroy() {
        this.stopTimer();
        this.stopDataStream();
        this.subscription.unsubscribe();
    }

    private startTimer() {
        this.stopTimer();
        this.intervalTimer = global.setInterval(() => this.steamDevicesService.updateItems(), 250);
    }

    private stopTimer() {
        if (this.intervalTimer !== undefined) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = undefined;
        }
    }

    private closeDevice() {
        this.waitForChange = true;
        ipcRenderer.send('deviceCloseReq');
    }

    private openDevice(devicePath: string) {
        this.waitForChange = true;
        ipcRenderer.send('deviceOpenReq', devicePath);
    }

    private startDataStream() {
        ipcRenderer.send('dataStreamStartReq');
    }

    private stopDataStream() {
        ipcRenderer.send('dataStreamStopReq');
    }
}