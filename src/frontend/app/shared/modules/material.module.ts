import { OverlayModule } from "@angular/cdk/overlay";
import { HttpClientModule } from "@angular/common/http";
import { NgModule } from "@angular/core";
import {
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatSelectModule,
    MatToolbarModule,
    MatTooltipModule,
} from "@angular/material";

const modules = [
    HttpClientModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatListModule,
    MatSelectModule,
    MatToolbarModule,
    MatTooltipModule,
    OverlayModule,
];

/**
 * Loads all used Material modules.
 */
@NgModule({
    exports: modules,
    imports: modules,
})
export class MaterialModule { }
