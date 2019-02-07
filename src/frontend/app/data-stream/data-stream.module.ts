import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { SharedModule } from "../shared/shared.module";
import { DataStreamComponent } from "./data-stream.component";
import { routes } from "./data-stream.routing";
import { DataStreamService } from "./data-stream.service";

@NgModule({
    declarations: [
        DataStreamComponent,
    ],
    exports: [
        RouterModule,
    ],
    imports: [
        ReactiveFormsModule,
        SharedModule,
        RouterModule.forChild(routes),
    ],
    providers: [
        DataStreamService,
    ],
})
export class DataStreamModule { }
