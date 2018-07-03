import { CommonModule } from "@angular/common";
import { NgModule, Optional, SkipSelf } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserService } from "./services/browser.service";
import { IpcService } from "./services/ipc.service";

@NgModule({
    exports: [
        CommonModule,
        BrowserModule,
    ],
    providers: [
        BrowserService,
        IpcService,
    ],
})
export class CoreModule {
    constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
        if (parentModule) {
            throw new Error("CoreModule is already loaded. Import it in the AppModule only");
        }
    }
}
