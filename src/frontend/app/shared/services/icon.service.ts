import { Injectable } from "@angular/core";
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import * as icons from "../preloads/icons.preload";

/**
 * Automatically loads icons used in this app.
 */
@Injectable({
    providedIn: "root",
})
export class IconService {
    constructor(private iconRegistry: MatIconRegistry, private sanitizer: DomSanitizer) {
        for (const icon in icons) {
            if (icons.hasOwnProperty(icon)) {
                const path = (icons as any)[icon];
                this.iconRegistry.addSvgIcon(icon, this.sanitizer.bypassSecurityTrustResourceUrl(path));
            }
        }
    }
}
