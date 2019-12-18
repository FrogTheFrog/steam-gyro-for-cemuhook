import { NgZone } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { Filter, MotionDataWithTimestamp, PositionTriplet } from "../../../../controller-api";
import { DataStreamObject, GraphDataItem, MotionDataGraphItem } from "../../models";

export class GraphData {
    /**
     * Data stream subject.
     */
    public dataStream = new BehaviorSubject<DataStreamObject[]>([]);

    /**
     * Instance of filter.
     */
    public filter = new Filter();

    /**
     * Accelerometer data.
     */
    private accelData!: MotionDataGraphItem;

    /**
     * Filtered accelerometer data.
     */
    private filteredAccelData!: MotionDataGraphItem;

    /**
     * Gyro data.
     */
    private gyroData!: MotionDataGraphItem;

    /**
     * Filtered gyro data.
     */
    private filteredGyroData!: MotionDataGraphItem;

    /**
     * Max data size until array rotation begins.
     */
    private maxSize: number = 500;

    /**
     * Currently observed sensor.
     */
    private currentSensor: "accelerometer" | "gyro" = "accelerometer";

    /**
     * Currently observed axis.
     */
    private currentAxis: "x" | "y" | "z" = "x";

    /**
     * Currently observed data set.
     */
    private currentDataSet: "original" | "filtered" | "both" = "original";

    constructor(private zone: NgZone) {
        this.clearData();
    }

    /**
     * `currentSensor` setter.
     */
    public set sensor(value: GraphData["currentSensor"]) {
        this.currentSensor = value;
        this.emitData();
    }

    /**
     * `currentSensor` getter.
     */
    public get sensor() {
        return this.currentSensor;
    }

    /**
     * `currentAxis` setter.
     */
    public set axis(value: GraphData["currentAxis"]) {
        this.currentAxis = value;
        this.emitData();
    }

    /**
     * `currentAxis` getter.
     */
    public get axis() {
        return this.currentAxis;
    }

    /**
     * `currentDataSet` setter.
     */
    public set dataSet(value: GraphData["currentDataSet"]) {
        this.currentDataSet = value;
        this.emitData();
    }

    /**
     * `currentDataSet` getter.
     */
    public get dataSet() {
        return this.currentDataSet;
    }

    /**
     * Recalculates filtered data from current values.
     */
    public recalculateFilteredData() {
        const { length } = this.accelData.x;
        this.filteredAccelData = this.emptyData();
        this.filteredGyroData = this.emptyData();
        this.filter.clear();

        for (let i = 0; i < length; i++) {
            const timestamp = this.accelData.x[i].name;
            const data: MotionDataWithTimestamp = {
                accelerometer: {
                    range: [0, 0],
                    x: this.accelData.x[i].value,
                    y: this.accelData.y[i].value,
                    z: this.accelData.z[i].value,
                },
                gyro: {
                    range: [0, 0],
                    x: this.gyroData.x[i].value,
                    y: this.gyroData.y[i].value,
                    z: this.gyroData.z[i].value,
                },
                timestamp,
            };
            const output = this.filter.setInput(data)
                .filter(50000)
                .getOutput();

            this.appendTriplet(this.filteredAccelData, output.accelerometer, timestamp);
            this.appendTriplet(this.filteredGyroData, output.gyro, timestamp);
        }

        this.zone.run(() => {
            this.emitData();
        });
    }

    /**
     * Adds data to array.
     */
    public addData(data: MotionDataWithTimestamp) {
        const { timestamp } = data;
        const output = this.filter.setInput(data)
            .filter(50000)
            .getOutput();

        this.appendTriplet(this.accelData, data.accelerometer, timestamp);
        this.appendTriplet(this.gyroData, data.gyro, timestamp);
        this.appendTriplet(this.filteredAccelData, output.accelerometer, timestamp);
        this.appendTriplet(this.filteredGyroData, output.gyro, timestamp);

        this.zone.run(() => {
            this.emitData();
        });
    }

    /**
     * Resets array data.
     */
    public clearData() {
        this.accelData = this.emptyData();
        this.filteredAccelData = this.emptyData();
        this.gyroData = this.emptyData();
        this.filteredGyroData = this.emptyData();
        this.filter.clear();
        this.emitData();
    }

    /**
     * Emits current data based on internal settings.
     */
    private emitData() {
        let axis: GraphDataItem[];
        let filteredAxis: GraphDataItem[];
        let sensorName: string;
        const data: DataStreamObject[] = [];

        if (this.currentSensor === "accelerometer") {
            sensorName = "Accel";
            axis = this.accelData[this.currentAxis];
            filteredAxis = this.filteredAccelData[this.currentAxis];
        } else {
            sensorName = "Gyro";
            axis = this.gyroData[this.currentAxis];
            filteredAxis = this.filteredGyroData[this.currentAxis];
        }

        if (axis.length > 0 && (this.currentDataSet === "original" || this.currentDataSet === "both")) {
            data.push({
                name: `${sensorName}.${this.currentAxis.toUpperCase()}`,
                series: axis,
            });
        }
        if (filteredAxis.length > 0 && (this.currentDataSet === "filtered" || this.currentDataSet === "both")) {
            data.push({
                name: `Filtered ${sensorName}.${this.currentAxis.toUpperCase()}`,
                series: filteredAxis,
            });
        }

        this.dataStream.next(data);
    }

    /**
     * Returns empty data object.
     */
    private emptyData(): MotionDataGraphItem {
        return { x: [], y: [], z: [] };
    }

    /**
     * Appends value to data array.
     * @param dataArray Array to append to.
     * @param value Value to append.
     * @param timestamp Timestamp to use.
     */
    private appendItem(dataArray: GraphDataItem[], value: number, timestamp: number) {
        if (dataArray.length === this.maxSize) {
            dataArray.shift();
        }
        dataArray.push({ name: timestamp, value });
    }

    /**
     * Appends new position triplet to current one.
     * @param currentDataTriplet Current data triplet to append to.
     * @param triplet Triplet to append.
     * @param timestamp Timestamp to use.
     */
    private appendTriplet(currentDataTriplet: MotionDataGraphItem, triplet: PositionTriplet, timestamp: number) {
        this.appendItem(currentDataTriplet.x, triplet.x, timestamp);
        this.appendItem(currentDataTriplet.y, triplet.y, timestamp);
        this.appendItem(currentDataTriplet.z, triplet.z, timestamp);
    }
}
