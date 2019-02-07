import { NgModule } from "@angular/core";
import { ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { SharedModule } from "../shared/shared.module";
import { ErrorComponent } from "./error/error.component";
import { InfoComponent } from "./info/info.component";
import { MessageLogComponent } from "./message-log.component";
import { routes } from "./message-log.routing";
import { MessageLogService } from "./message-log.service";

@NgModule({
    declarations: [
        MessageLogComponent,
        ErrorComponent,
        InfoComponent,
    ],
    entryComponents: [
        ErrorComponent,
        InfoComponent,
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
        MessageLogService,
    ],
})
export class MessageLogModule { }
