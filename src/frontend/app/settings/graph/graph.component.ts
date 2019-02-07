import { Component, OnDestroy, OnInit } from "@angular/core";
import { Observable } from "rxjs";
import { DataStreamObject } from "../../models";
import { SettingsService } from "../settings.service";
import { GraphData } from "./graph-data";

/**
 * Handles drawing of line graphs.
 */
@Component({
    selector: "graph",
    styleUrls: ["./graph.style.scss"],
    templateUrl: "./graph.template.html",
})
export class GraphComponent implements OnInit, OnDestroy {
    /**
     * Indicates whether motion data is streaming.
     */
    public isStreaming!: Observable<boolean>;

    /**
     * Observable of graph stream data.
     */
    public dataStream!: Observable<DataStreamObject[]>;

    /**
     * Color scheme for graph.
     */
    public colorScheme = {
        domain: ["#5AA454", "#A10A28"],
    };

    constructor(
        private settingsService: SettingsService,
    ) {

    }

    public set sensor(value: GraphData["currentSensor"]) {
        this.settingsService.graphData.sensor = value;
    }

    public get sensor() {
        return this.settingsService.graphData.sensor;
    }

    public set axis(value: GraphData["currentAxis"]) {
        this.settingsService.graphData.axis = value;
    }

    public get axis() {
        return this.settingsService.graphData.axis;
    }

    public set dataSet(value: GraphData["currentDataSet"]) {
        this.settingsService.graphData.dataSet = value;
    }

    public get dataSet() {
        return this.settingsService.graphData.dataSet;
    }

    /**
     * Initialize observables and etc.
     */
    public ngOnInit() {
        this.isStreaming = this.settingsService.dataIsStreaming.asObservable();
        this.dataStream = this.settingsService.graphData.dataStream.asObservable();
    }

    /**
     * Cleanup.
     */
    public ngOnDestroy() {
        this.settingsService.stopMotionDataStream();
    }

    /**
     * Toggle data stream.
     */
    public toggleStream() {
        if (this.settingsService.dataIsStreaming.value) {
            this.settingsService.stopMotionDataStream();
        } else {
            this.settingsService.startMotionDataStream();
        }
    }
}
