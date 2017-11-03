// Core
import { NgModule } from '@angular/core';
import { BrowserModule, Title } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DatePipe, APP_BASE_HREF } from '@angular/common';

// Material
import {
    MatToolbarModule, MatIconModule, MatButtonModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatCheckboxModule, MatTooltipModule, MatProgressSpinnerModule
} from '@angular/material';

// Helpers
import { angular } from "../lib/helpers";

// Angular App
import * as Components from './components';
import * as Directives from './directives';
import * as Services from './services';
import { Routes } from './main.routing';

@NgModule({
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        Routes,
        FormsModule,
        ReactiveFormsModule,
        MatToolbarModule,
        MatIconModule,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatCheckboxModule,
        MatTooltipModule,
        MatProgressSpinnerModule
    ],
    declarations: [].concat(
        angular.ngObjectsToArray(Components),
        angular.ngObjectsToArray(Directives)
    ),
    providers: [].concat(
        angular.ngObjectsToArray(Services),
        { provide: APP_BASE_HREF, useValue: 'SGFC' },
        DatePipe,
        Title
    ),
    bootstrap: [Components.MainComponent]
})
export class MainModule { }