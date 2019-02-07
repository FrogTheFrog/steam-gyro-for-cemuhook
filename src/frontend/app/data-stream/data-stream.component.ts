import { Component, OnDestroy, OnInit } from "@angular/core";
import { Observable } from "rxjs";
import { map, startWith } from "rxjs/operators";
import { DataStreamService } from "./data-stream.service";

/**
 * Streams and shows raw data.
 */
@Component({
    selector: "data-stream",
    styleUrls: ["./data-stream.style.scss"],
    templateUrl: "./data-stream.template.html",
})
export class DataStreamComponent implements OnInit, OnDestroy {
    /**
     * Stringified data stream.
     */
    public stream!: Observable<string>;

    constructor(private dataStream: DataStreamService) {
    }

    /**
     * Start streaming.
     */
    public ngOnInit() {
        this.stream = this.dataStream.stream
            .pipe(
                map((data) => JSON.stringify(data, undefined, "    ")),
                startWith("Data is unavailable (try interacting with your controller)."),
            );
        this.dataStream.start();
    }

    /**
     * Stop streaming.
     */
    public ngOnDestroy() {
        this.dataStream.stop();
    }
}
