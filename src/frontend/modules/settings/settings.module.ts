// Core
import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { GeneralSettings } from "./components/general-settings.component";
import { SettingsPage } from "./pages/settings.page";
import { SettingsRouting } from "./settings.routing";

// Material
import {
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatToolbarModule,
} from "@angular/material";

@NgModule({
    declarations: [
        GeneralSettings,
        SettingsPage,
    ],
    imports: [
        FormsModule,
        ReactiveFormsModule,
        BrowserAnimationsModule,

        MatButtonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatInputModule,
        MatToolbarModule,
        SettingsRouting,
    ],
})
export class SettingsModule { }
