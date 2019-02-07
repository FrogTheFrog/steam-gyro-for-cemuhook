import { FilterData, MotionDataWithTimestamp, PositionTripletWithRange, TypedFilterData } from "../models";

/**
 * Allowed data sets for filter.
 */
type DataSet = "accelerometer" | "gyro";

/**
 * Allowed data fields for filter.
 */
type DataField = "x" | "y" | "z";

/**
 * Returns zeroed data triplet.
 */
function zeroData(): PositionTripletWithRange {
    return {
        range: [0, 0],
        x: 0,
        y: 0,
        z: 0,
    };
}

/**
 * Clones motion data object
 */
function cloneData(data: MotionDataWithTimestamp): MotionDataWithTimestamp {
    const clonedData = {
        accelerometer: { ...data.accelerometer },
        gyro: { ...data.gyro },
        timestamp: data.timestamp,
    };
    clonedData.accelerometer.range = [...data.accelerometer.range] as [number, number];
    clonedData.gyro.range = [...data.gyro.range] as [number, number];
    return clonedData;
}

/**
 * Available fields.
 */
const fields: ["x", "y", "z"] = ["x", "y", "z"];

/**
 * Applies various filters to provided input and generates output.
 */
export class Filter {
    /**
     * Current filter input.
     */
    private in: MotionDataWithTimestamp;

    /**
     * Current filter output.
     */
    private out!: MotionDataWithTimestamp;

    /**
     * Previous filter input.
     */
    private pIn: MotionDataWithTimestamp | null = null;

    /**
     * Previous filter output.
     */
    private pOut: MotionDataWithTimestamp | null = null;

    /**
     * Current filter type and value.
     */
    private typeAndValue: TypedFilterData = { type: "disabled", value: [] };

    constructor() {
        this.in = {
            accelerometer: zeroData(),
            gyro: zeroData(),
            timestamp: 0,
        };
        this.clear();
    }

    /**
     * Set filter's input.
     * @param data Motion data value.
     */
    public setInput(data: MotionDataWithTimestamp) {
        this.pIn = this.in;
        this.in = cloneData(data);
        return this;
    }

    /**
     * Get filter's output.
     * @param data Motion data value.
     */
    public getOutput() {
        return cloneData(this.out);
    }

    /**
     * Clears filter's internal data.
     */
    public clear() {
        this.out = {
            accelerometer: zeroData(),
            gyro: zeroData(),
            timestamp: 0,
        };
        this.pOut = null;
        this.pIn = null;
    }

    /**
     * Sets filter type and data.
     * @param data Filter type and data.
     */
    public setFilter(data: TypedFilterData) {
        if (data.type !== this.typeAndValue.type) {
            this.clear();
        }
        this.typeAndValue = data;
    }

    /**
     * Generates output based on input.
     * @param autoClearAfter Clear filter if specified time interval (in microseconds) has elapsed since last filtering.
     */
    public filter(autoClearAfter?: number) {
        let elapsedTime = this.out.timestamp - this.in.timestamp;
        let assignRest: boolean = false;
        if (typeof autoClearAfter === "number" && elapsedTime > autoClearAfter) {
            this.clear();
            elapsedTime = this.out.timestamp - this.in.timestamp;
        }
        
        switch (this.typeAndValue.type) {
            case "disabled":
                this.out = this.in;
                break;
            case "low-high-pass": {
                const { value } = this.typeAndValue;
                const dT = elapsedTime <= 0 ? 1 : elapsedTime;
                const aAlpha = dT / (value[0] + dT);
                const gAlpha = value[1] / (value[1] + dT);
                for (const field of fields) {
                    this.lowPassFilter("accelerometer", field, aAlpha);
                    this.highPassFilter("gyro", field, gAlpha);
                }
                assignRest = true;
                break;
            }
            default:
                throw new Error("Unknown filter type");
        }

        if (assignRest) {
            this.out.accelerometer.range = [...this.in.accelerometer.range] as [number, number];
            this.out.gyro.range = [...this.in.gyro.range] as [number, number];
            this.out.timestamp = this.in.timestamp;
        }

        this.pOut = this.out;

        return this;
    }

    /**
     * Applies low pass filter to motionData[set][field] with provided alpha value.
     * @param set Set to be used.
     * @param field Field to be used.
     * @param alpha Alpha value to be used.
     */
    private lowPassFilter(set: DataSet, field: DataField, alpha: number) {
        if (this.pOut !== null) {
            this.out[set][field] = this.pOut[set][field] + (alpha * (this.in[set][field] - this.pOut[set][field]));
        } else {
            this.out[set][field] = alpha * this.in[set][field];
        }
    }

    /**
     * Applies high pass filter to motionData[set][field] with provided alpha value.
     * @param set Set to be used.
     * @param field Field to be used.
     * @param alpha Alpha value to be used.
     */
    private highPassFilter(set: DataSet, field: DataField, alpha: number) {
        if (this.pOut !== null && this.pIn !== null) {
            this.out[set][field] = alpha * (this.pOut[set][field] + this.in[set][field] - this.pIn[set][field]);
        } else {
            this.out[set][field] = this.in[set][field];
        }
    }
}
