import { SettingsService } from '../services';
import { ipcRenderer } from "electron";
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormBuilder, AbstractControl, Validators } from "@angular/forms";
import { userSettings } from "../../lib/settings.model";
import { validator } from "../../lib/helpers";
import { Subscription } from "rxjs";

@Component({
    selector: 'settings',
    template: `
        <form (click)="saveSettings()" [formGroup]="settingsForm">
            <div class="UDP_server">
                <mat-toolbar>
                    General Settings
                </mat-toolbar>
                <div class="container">
                    <ng-container formGroupName="server">
                        <mat-form-field>
                            <mat-hint align="end">Requires restart</mat-hint>
                            <input matInput type="text" placeholder="Server address" formControlName="address">
                            <mat-error *ngIf="hasErrors('server.address')">{{getErrorMsg('server.address')}}</mat-error>
                        </mat-form-field>
                        <mat-form-field>
                            <mat-hint align="end">Requires restart</mat-hint>
                            <input matInput type="number" placeholder="Server port" formControlName="port">
                            <mat-error *ngIf="hasErrors('server.port')">{{getErrorMsg('server.port')}}</mat-error>
                        </mat-form-field>
                    </ng-container>
                    <mat-checkbox formControlName="silentErrors">Silent errors</mat-checkbox>
                </div>
            </div>
            <ng-container formGroupName="postScalers">
                <div class="gyro" formGroupName="gyro">
                    <mat-toolbar>
                        Gyroscope
                    </mat-toolbar>
                    <div class="container">
                        <mat-form-field>
                            <input matInput type="number" placeholder="X postscaler value" formControlName="x">
                            <mat-error *ngIf="hasErrors('postScalers.gyro.x')">{{getErrorMsg('postScalers.gyro.x')}}</mat-error>
                        </mat-form-field>
                        <mat-form-field>
                            <input matInput type="number" placeholder="Y postscaler value" formControlName="y">
                            <mat-error *ngIf="hasErrors('postScalers.gyro.y')">{{getErrorMsg('postScalers.gyro.y')}}</mat-error>
                        </mat-form-field>
                        <mat-form-field>
                            <input matInput type="number" placeholder="Z postscaler value" formControlName="z">
                            <mat-error *ngIf="hasErrors('postScalers.gyro.z')">{{getErrorMsg('postScalers.gyro.z')}}</mat-error>
                        </mat-form-field>
                    </div>
                </div>
                <div class="accelerometer" formGroupName="accelerometer">
                    <mat-toolbar>
                        Accelerometer
                    </mat-toolbar>
                    <div class="container">
                        <mat-form-field>
                            <input matInput type="number" placeholder="X postscaler value" formControlName="x">
                            <mat-error *ngIf="hasErrors('postScalers.accelerometer.x')">{{getErrorMsg('postScalers.accelerometer.x')}}</mat-error>
                        </mat-form-field>
                        <mat-form-field>
                            <input matInput type="number" placeholder="Y postscaler value" formControlName="y">
                            <mat-error *ngIf="hasErrors('postScalers.accelerometer.y')">{{getErrorMsg('postScalers.accelerometer.y')}}</mat-error>
                        </mat-form-field>
                        <mat-form-field>
                            <input matInput type="number" placeholder="Z postscaler value" formControlName="z">
                            <mat-error *ngIf="hasErrors('postScalers.accelerometer.z')">{{getErrorMsg('postScalers.accelerometer.z')}}</mat-error>
                        </mat-form-field>
                    </div>
                </div>
            </ng-container>
            <div class="toolbar">
                <span class="fill-remaining-space"></span>
                <button mat-button (click)="restartServer()">Restart server</button>
                <button type="submit" mat-button color="primary">Save settings</button>
            </div>
        </form>
    `,
    styleUrls: ['../styles/settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit {
    private settingsForm: FormGroup;
    private userSettings: userSettings.type = undefined;
    private subscription: Subscription = new Subscription();

    constructor(private fb: FormBuilder, private settingsService: SettingsService, private changeDetectorRef: ChangeDetectorRef) { }

    private getErrorMsg(controlPath: string) {
        let control = this.settingsForm.get(controlPath);

        if (control.errors['invalidPattern']) {
            return control.errors['invalidPattern'];
        }
        else if (control.errors['required']) {
            return 'Input is required';
        }
        else if (control.errors['invalidAddress']) {
            return 'Invalid IPv4 address';
        }
    }

    private hasErrors(controlPath: string) {
        return this.settingsForm.get(controlPath).errors !== null;
    }

    private patternValidator(pattern: RegExp, error: string) {
        return (control: AbstractControl) => {
            return !pattern.test(control.value) ? { 'invalidPattern': error } : null;
        }
    }

    private restartServer() {
        ipcRenderer.send('restartServer');
    }

    private saveSettings() {
        if (this.settingsForm.valid) {
            ipcRenderer.send('saveSettingsReq', this.settingsForm.value);
        }
    }

    ngOnInit() {
        this.settingsForm = this.fb.group({
            server: this.fb.group({
                address: [null, [Validators.required, (control: AbstractControl) => { return !validator.isValidIPv4(control.value) ? { 'invalidAddress': true } : null; }]],
                port: [null, [this.patternValidator(/^\d*$/, 'Invalid port'), Validators.required]],
            }),
            silentErrors: [null],
            postScalers: this.fb.group({
                gyro: this.fb.group({
                    x: [null, [this.patternValidator(/^-?\d+(?:\.\d)?\d*$/, 'Invalid number'), Validators.required]],
                    y: [null, [this.patternValidator(/^-?\d+(?:\.\d)?\d*$/, 'Invalid number'), Validators.required]],
                    z: [null, [this.patternValidator(/^-?\d+(?:\.\d)?\d*$/, 'Invalid number'), Validators.required]]
                }),
                accelerometer: this.fb.group({
                    x: [null, [this.patternValidator(/^-?\d+(?:\.\d)?\d*$/, 'Invalid number'), Validators.required]],
                    y: [null, [this.patternValidator(/^-?\d+(?:\.\d)?\d*$/, 'Invalid number'), Validators.required]],
                    z: [null, [this.patternValidator(/^-?\d+(?:\.\d)?\d*$/, 'Invalid number'), Validators.required]]
                })
            }),
            modifierVersion: [null]
        });

        this.subscription.add(this.settingsService.settings.subscribe((userSettings) => {
            this.userSettings = userSettings;
            if (this.userSettings !== undefined) {
                this.settingsForm.setValue(this.userSettings);
                this.changeDetectorRef.detectChanges();
            }
        }));

        let serverForm = this.settingsForm.get('server');
        let gyroForm = this.settingsForm.get('postScalers.gyro');
        let accelerometerForm = this.settingsForm.get('postScalers.accelerometer');

        this.subscription.add(gyroForm.valueChanges.subscribe((data: { x: number, y: number, z: number }) => {
            if (gyroForm.valid) {
                ipcRenderer.send('updateGyroReq', data);
            }
        }));

        this.subscription.add(accelerometerForm.valueChanges.subscribe((data: { x: number, y: number, z: number }) => {
            if (accelerometerForm.valid) {
                ipcRenderer.send('updateAccelerometerReq', data);
            }
        }));

        this.subscription.add(serverForm.valueChanges.subscribe((data: { address: string, port: number }) => {
            if (serverForm.valid) {
                ipcRenderer.send('updateServerReq', data);
            }
        }));

        this.subscription.add(this.settingsForm.get('silentErrors').valueChanges.subscribe((data: boolean) => {
            ipcRenderer.send('updateErrorSettingsReq', !!data);
        }));
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}