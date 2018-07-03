import { DualshockMeta } from "./dualshock-meta.interface";
import { DualshockReport } from "./dualshock-report.interface";

export interface DualshockEvents {
    open: any;
    close: void;
    dualshockData: { report: DualshockReport, meta: DualshockMeta };
    report: object;
    error: Error;
}
