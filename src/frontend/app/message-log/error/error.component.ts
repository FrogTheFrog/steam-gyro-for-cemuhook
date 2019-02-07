import { Component, Inject } from "@angular/core";
import { MESSAGE_OBJECT_DATA } from "../message-data.token";
import { MessageOverlayRef } from "../message-overlay-ref";

/**
 * Displays error.
 */
@Component({
    selector: "error",
    styleUrls: ["./error.style.scss"],
    templateUrl: "./error.template.html",
})
export class ErrorComponent {
    constructor(public messageRef: MessageOverlayRef, @Inject(MESSAGE_OBJECT_DATA) public data: Error) {
    }
}
