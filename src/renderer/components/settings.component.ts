import { SettingsService } from '../services';
import { ipcRenderer } from "./../../lib/ipc.model";
import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormBuilder, AbstractControl, Validators, FormArray } from "@angular/forms";
import { userSettings } from "../../lib/settings.model";
import { validator } from "../../lib/helpers";
import { Subscription } from "rxjs";
import { Filter } from '../../lib/filter';

@Component({
    selector: 'settings',
    template: `
        <div class="container">
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
                        <ng-container formGroupName="enabledFilters">
                            <mat-checkbox formControlName="gyro">Enable gyro filters</mat-checkbox>
                            <mat-checkbox formControlName="accelerometer">Enable accelerometer filters</mat-checkbox>
                        </ng-container>
                    </div>
                </div>
                <ng-container formGroupName="filters">
                    <div class="accelerometer" formGroupName="accelerometer" *ngVar="settingsForm.get('filters.accelerometer') as filters">
                        <mat-toolbar>
                            Accelerometer filters
                        </mat-toolbar>
                        <mat-tab-group>
                            <mat-tab *ngFor="let filter of filters.controls; let i=index" [label]="i">
                                <ng-container [formGroupName]="i">
                                    <mat-form-field>
                                        <mat-select formGroupName="type">
                                            <mat-option *ngFor="let option of availableFilters" [value]="option">{{option}}</mat-option>
                                        </mat-select>
                                    </mat-form-field>
                                </ng-container>
                            </mat-tab>
                        </mat-tab-group>
                        <mat-toolbar>
                            <button mat-button color="warn">Remove</button>
                            <button mat-button (click)="addFilter('filters')">Add</button>
                        </mat-toolbar>
                    </div>
                    <div class="gyro">
                        <mat-toolbar>
                            Gyroscope filter
                        </mat-toolbar>
                        <div class="container">
                            <mat-form-field>
                                <input matInput type="number" placeholder="ALPHA">
                            </mat-form-field>
                            <mat-form-field>
                                <input matInput type="number" placeholder="Something">
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
        </div>
    `,
    styleUrls: ['../styles/settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit {
    private availableFilters = Filter.getAvailableFilters();
    private settingsForm: FormGroup;
    private userSettings: userSettings.Type = undefined;
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
        ipcRenderer.send('restartServer', void 0);
    }

    private saveSettings() {
        if (this.settingsForm.valid) {
            ipcRenderer.send('saveUserSettings', this.settingsForm.value);
        }
    }

    private getDefaultFilterElement() {
        return this.fb.group({
            type: ['None'],
            filterAllAtOnce: [false],
            deviation: this.fb.group({
                min: [0],
                max: [0.01]
            }),
            coefficients: this.fb.array([])
        });
    }

    private addFilter(formArray: FormArray) {
        formArray.push(this.getDefaultFilterElement());
    }

    private modifyFilterFormArrayLength(formArray: FormArray, filters: Filter.Type[]) {
        if (formArray.length < filters.length) {
            let element = this.fb.group({
                type: [null],
                filterAllAtOnce: [null],
                deviation: this.fb.group({
                    min: [null],
                    max: [null]
                }),
                coefficients: this.fb.array([])
            });

            for (let i = 0; i <= filters.length - formArray.length; i++)
                formArray.push(element);
        }
        else if (formArray.length > filters.length) {
            for (let i = filters.length; i < formArray.length; i++)
                formArray.removeAt(i - 1)
        }
    }

    ngOnInit() {
        this.settingsForm = this.fb.group({
            server: this.fb.group({
                address: [null, [Validators.required, (control: AbstractControl) => { return !validator.isValidIPv4(control.value) ? { 'invalidAddress': true } : null; }]],
                port: [null, [this.patternValidator(/^\d*$/, 'Invalid port'), Validators.required]],
            }),
            enabledFilters: this.fb.group({
                gyro: [null],
                accelerometer: [null]
            }),
            silentErrors: [null],
            filters: this.fb.group({
                gyro: this.fb.array([]),
                accelerometer: this.fb.array([])
            }),
            modifierVersion: [null]
        });

        this.subscription.add(this.settingsService.settings.subscribe((userSettings) => {
            this.userSettings = userSettings;
            if (this.userSettings !== undefined) {
                this.modifyFilterFormArrayLength(this.settingsForm.get('filters.gyro') as FormArray, userSettings.filters.gyro);
                this.modifyFilterFormArrayLength(this.settingsForm.get('filters.accelerometer') as FormArray, userSettings.filters.accelerometer);

                this.settingsForm.setValue(this.userSettings);
                this.changeDetectorRef.detectChanges();
            }
        }));

        //[null, [this.patternValidator(/^-?\d+(?:\.\d)?\d*$/, 'Invalid number'), Validators.required]]

        let serverForm = this.settingsForm.get('server');

        this.subscription.add(serverForm.valueChanges.subscribe((data: { address: string, port: number }) => {
            if (serverForm.valid) {
                ipcRenderer.send('updateServer', data);
            }
        }));

        this.subscription.add(this.settingsForm.get('silentErrors').valueChanges.subscribe((data: boolean) => {
            ipcRenderer.send('toggleSilentErrors', !!data);
        }));
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}