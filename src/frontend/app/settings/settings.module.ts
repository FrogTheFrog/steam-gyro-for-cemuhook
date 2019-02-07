import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { NgxChartsModule } from "@swimlane/ngx-charts";
import { SharedModule } from "../shared/shared.module";
import { FilterComponent } from "./filter/filter.component";
import { GraphComponent } from "./graph/graph.component";
import { ServerComponent } from "./server/server.component";
import { SettingsComponent } from "./settings.component";
import { routes } from "./settings.routing";
import { SettingsService } from "./settings.service";

@NgModule({
    declarations: [
        SettingsComponent,
        ServerComponent,
        FilterComponent,
        GraphComponent,
    ],
    exports: [
        RouterModule,
    ],
    imports: [
        NgxChartsModule,
        ReactiveFormsModule,
        SharedModule,
        RouterModule.forChild(routes),
    ],
    providers: [
        SettingsService,
    ],
})
export class SettingsModule { }
