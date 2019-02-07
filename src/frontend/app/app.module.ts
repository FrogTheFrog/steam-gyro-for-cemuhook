import { APP_BASE_HREF } from "@angular/common";
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { RouterModule } from "@angular/router";
import { AppComponent } from "./app.component";
import { routes } from "./app.routing";
import { DataStreamModule } from "./data-stream/data-stream.module";
import { MessageLogModule } from "./message-log/message-log.module";
import { SettingsModule } from "./settings/settings.module";
import { SharedModule } from "./shared/shared.module";

/**
 * App entry module.
 */
@NgModule({
    bootstrap: [
        AppComponent,
    ],
    declarations: [
        AppComponent,
    ],
    imports: [
        BrowserModule,
        BrowserAnimationsModule,
        RouterModule.forRoot(routes, { useHash: true }),
        SharedModule,
        MessageLogModule,
        SettingsModule,
        DataStreamModule,
    ],
    providers: [
        { provide: APP_BASE_HREF, useValue: "SGFC" },
    ],
})
export class AppModule { }
