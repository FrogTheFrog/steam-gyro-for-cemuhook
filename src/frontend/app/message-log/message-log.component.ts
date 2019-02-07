import { Component, OnInit } from "@angular/core";
import { MessageObject } from "../../../shared/models";
import { MessageLogService } from "./message-log.service";

/**
 * Provides a log of occurred errors.
 */
@Component({
    selector: "message-log",
    styleUrls: ["./message-log.style.scss"],
    templateUrl: "./message-log.template.html",
})
export class MessageLogComponent implements OnInit {
    constructor(public messageLogService: MessageLogService) {

    }

    public ngOnInit() {
        //
    }

    /**
     * Show message in overlay.
     */
    public showMessage(message: MessageObject) {
        this.messageLogService.open(message);
    }
}
