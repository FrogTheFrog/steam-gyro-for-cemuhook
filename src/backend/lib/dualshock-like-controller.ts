import { Subject } from "rxjs";
import { Filter, privateData } from "../../shared/lib";
import { MotionDataWithTimestamp, TypedFilterData } from "../../shared/models";
import {
    DualshockData,
    DualshockMeta,
    DualshockReport,
    GenericDualshockController,
    SteamDeviceReport,
} from "../models";
import { SteamDevice } from "./steam-device";

/**
 * Internal class data interface.
 */
interface InternalData {
    dualshockDataSubject: Subject<DualshockData>;
    errorSubject: Subject<Error>;
    motionDataSubject: Subject<MotionDataWithTimestamp>;
    openCloseSubject: Subject<{ info: string, status: boolean }>;
    reportSubject: Subject<SteamDeviceReport>;
}

/**
 * Private data getter.
 */
const getInternals = privateData() as (self: DualshockLikeController, init: InternalData | void) => InternalData;

/**
 * Class wrapper for handling various controllers as Dualshock compatible.
 */
export class DualshockLikeController extends GenericDualshockController<SteamDeviceReport> {
    /**
     * Currently open device.
     */
    private device: SteamDevice = new SteamDevice();

    /**
     * Instance of filter.
     */
    private filter: Filter = new Filter();

    constructor(private id: number) {
        super();
        const pd = getInternals(this, {
            dualshockDataSubject: new Subject(),
            errorSubject: new Subject(),
            motionDataSubject: new Subject(),
            openCloseSubject: new Subject(),
            reportSubject: new Subject(),
        });

        this.device.onError.subscribe((value) => pd.errorSubject.next(value));
        this.device.onMotionsData.subscribe((value) => pd.motionDataSubject.next(value));
        this.device.onOpenClose.subscribe((value) => pd.openCloseSubject.next(value));
        this.device.onReport.subscribe((value) => {
            const output = this.filter.setInput(value).filter(50000).getOutput();
            let meta: DualshockMeta | null;
            let report: DualshockReport | null;

            value = { ...value, ...output };
            pd.reportSubject.next(value);

            meta = this.device.reportToDualshockMeta(value, this.id);
            report = this.device.reportToDualshockReport(value);

            if (report !== null && meta !== null) {
                pd.dualshockDataSubject.next({ meta, report });
            }
        });
    }

    public get report() {
        return this.device.isOpen() ? this.device.report : null;
    }

    public get motionData() {
        return this.device.isOpen() ? this.device.motionData : null;
    }

    public get onDualshockData() {
        return getInternals(this).dualshockDataSubject.asObservable();
    }

    public get onReport() {
        return getInternals(this).reportSubject.asObservable();
    }

    public get onMotionsData() {
        return getInternals(this).motionDataSubject.asObservable();
    }

    public get onError() {
        return getInternals(this).errorSubject.asObservable();
    }

    public get onOpenClose() {
        return getInternals(this).openCloseSubject.asObservable();
    }

    public get infoString() {
        return this.device.infoString;
    }

    public open() {
        this.device.open();
        return this;
    }

    public isOpen() {
        return this.device.isOpen();
    }

    public close() {
        this.device.close();
        return this;
    }

    public setFilter(data: TypedFilterData) {
        this.filter.setFilter(data);
    }

    /**
     * Start watching for controllers.
     */
    public startWatching() {
        this.device.startWatching();
        return this;
    }

    /**
     * Stop watching for controllers.
     */
    public stopWatching() {
        this.device.stopWatching();
        return this;
    }

    public get dualShockMeta() {
        return this.isOpen() ? this.device.reportToDualshockMeta(this.device.report!, this.id) : null;
    }

    public get dualShockReport() {
        return this.isOpen() ? this.device.reportToDualshockReport(this.device.report!) : null;
    }
}
