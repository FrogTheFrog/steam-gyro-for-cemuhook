import { Component, Inject } from "@angular/core";
import { MessageObject } from "../../../../shared/models";
import { MESSAGE_OBJECT_DATA } from "../message-data.token";
import { MessageOverlayRef } from "../message-overlay-ref";

/**
 * Displays information.
 */
@Component({
    selector: "info",
    styleUrls: ["./info.style.scss"],
    templateUrl: "./info.template.html",
})
export class InfoComponent {
    constructor(public messageRef: MessageOverlayRef, @Inject(MESSAGE_OBJECT_DATA) public data: MessageObject["data"]) {
    }
}
