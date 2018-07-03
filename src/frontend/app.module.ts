// Core
import { APP_BASE_HREF, CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

// App
import { MatButtonModule, MatToolbarModule } from "@angular/material";
import { AppComponent } from "./app.component";
import { AppRouting } from "./app.routing";
import { CoreModule } from "./core/core.module";
import { SettingsModule } from "./modules/settings/settings.module";

@NgModule({
    bootstrap: [AppComponent],
    declarations: [
        AppComponent,
    ],
    imports: [
        CoreModule,
        MatToolbarModule,
        MatButtonModule,
        SettingsModule,
        AppRouting,
    ],
    providers: [
        { provide: APP_BASE_HREF, useValue: "SGFC" },
    ],
})
export class AppModule { }
