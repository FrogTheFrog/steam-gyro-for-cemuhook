import { Observable } from "rxjs";
import { DualshockEvents } from "../models/interface/dualshock-events.interface";
import { DualshockMeta } from "../models/interface/dualshock-meta.interface";
import { DualshockReport } from "../models/interface/dualshock-report.interface";
import { GenericEvent } from "../models/type/generic-event.type";

export abstract class DualshockGenericController {
    public abstract readonly events: Observable<GenericEvent<DualshockEvents>>;
    public abstract open(): this;
    public abstract close(): this;
    public abstract isOpen(): boolean;
    public abstract getDualShockMeta(): DualshockMeta | null;
    public abstract getDualShockReport(): DualshockReport | null;
}
