import { DOCUMENT } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit, Renderer2 } from "@angular/core";
import { AutoUnsubscribe } from "ngx-auto-unsubscribe";
import { Subscription } from "rxjs";
import { BrowserService } from "./core/services/browser.service";
import { IpcService } from "./core/services/ipc.service";

@AutoUnsubscribe()
@Component({
    selector: "app",
    styleUrls: ["./app.style.scss"],
    templateUrl: "./app.template.html",
})
export class AppComponent implements OnInit, OnDestroy {
    private browserEvents!: Subscription;

    constructor(
        public browser: BrowserService,
        private ipc: IpcService,
        private renderer: Renderer2,
        @Inject(DOCUMENT) private document: Document,
    ) { }

    public ngOnInit() {
        this.browserEvents = this.browser.events.subscribe((event) => {
            if (event === "maximize") {
                this.renderer.removeClass(this.document.body, "window-resize-border");
            }
            else if (event === "unmaximize") {
                this.renderer.addClass(this.document.body, "window-resize-border");
            }
        });

        if (!this.browser.window.isMaximized()) {
            this.renderer.addClass(this.document.body, "window-resize-border");
        }

        this.ipc.send("angularLoaded", void 0);
    }

    public ngOnDestroy(){
        // AutoUnsubscribe
    }
}
