import { DualshockMeta } from "./dualshock-meta.interface";
import { DualshockReport } from "./dualshock-report.interface";
import { MotionData } from "./motion-data.interface";

export interface DualshockEvents {
    open: any;
    close: void;
    dualshockData: { report: DualshockReport, meta: DualshockMeta };
    report: object;
    motionData: MotionData;
    error: Error;
}
