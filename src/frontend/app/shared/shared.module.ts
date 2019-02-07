import { CommonModule } from "@angular/common";
import { APP_INITIALIZER, NgModule, Provider } from "@angular/core";
import { MaterialModule } from "./modules/material.module";
import { IconService } from "./services/icon.service";
import { IpcService } from "./services/ipc.service";

const modules = [
    CommonModule,
    MaterialModule,
];
const providers: Provider[] = [
    IpcService,
    IconService,
    {
        deps: [IconService],
        multi: true,
        provide: APP_INITIALIZER,
        useFactory: (is: IconService) => () => void (0),
    },
];

/**
 * Loads all shared modules, services and etc.
 */
@NgModule({
    exports: modules,
    imports: modules,
    providers,
})
export class SharedModule { }
