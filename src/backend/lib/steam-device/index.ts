import { Subject, Subscription } from "rxjs";
import { privateData } from "../../../shared/lib";
import { MotionDataWithTimestamp } from "../../../shared/models";
import { GenericSteamDevice, SteamDeviceReport } from "../../models";
import { SteamHidDevice } from "./steam-hid-device";

/**
 * Internal class data interface.
 */
interface InternalData {
    errorSubject: Subject<Error>;
    motionDataSubject: Subject<MotionDataWithTimestamp>;
    openCloseSubject: Subject<{ info: string, status: boolean }>;
    reportSubject: Subject<SteamDeviceReport>;
    infoString: string | null;
}

/**
 * Private data getter.
 */
const getInternals = privateData() as (self: SteamDevice, init: InternalData | void) => InternalData;

/**
 * A generic Steam device.
 */
export class SteamDevice extends GenericSteamDevice {
    /**
     * Currently open steam device.
     */
    private device: GenericSteamDevice | null = null;

    /**
     * GenericSteamDevice's event subscriptions.
     */
    private deviceEvents = new Subscription();

    /**
     * Event subscription for monitoring events.
     */
    private watcherEvents = new Subscription();

    /**
     * Data for device watcher.
     */
    private watcher = { timer: null as (NodeJS.Timer | null), isWatching: false };

    constructor() {
        super();
        getInternals(this, {
            errorSubject: new Subject(),
            motionDataSubject: new Subject(),
            openCloseSubject: new Subject(),
            reportSubject: new Subject(),
            infoString: null,
        });
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
        return getInternals(this).infoString;
    }

    public get report() {
        return this.device != null ? this.device.report : null;
    }

    public get motionData() {
        return this.device != null ? this.device.motionData : null;
    }

    public open() {
        this.close();
        const pd = getInternals(this);

        this.device = (() => {
            // Try HID devices first
            const device = new SteamHidDevice();
            if (device.open().isOpen()) {
                pd.infoString = device.infoString;
                return device;
            }

            return null;
        })();

        if (this.isOpen()) {
            pd.openCloseSubject.next({ info: pd.infoString!, status: true });

            this.deviceEvents = new Subscription()
                .add(this.device!.onMotionsData.subscribe((value) => pd.motionDataSubject.next(value)))
                .add(this.device!.onReport.subscribe((value) => pd.reportSubject.next(value)))
                .add(this.device!.onError.subscribe((value) => pd.errorSubject.next(value)))
                .add(this.device!.onOpenClose.subscribe((value) => {
                    if (value.status === false) {
                        this.close();
                    }
                }));
        }

        return this;
    }

    public close() {
        if (this.isOpen()) {
            const pd = getInternals(this);
            const info = pd.infoString!;

            this.deviceEvents.unsubscribe();
            this.device!.close();
            this.device = null;
            pd.infoString = null;

            pd.openCloseSubject.next({ info, status: false });
            this.watcherCallback();
        }

        return this;
    }

    public isOpen() {
        return this.device !== null;
    }

    /**
     * Start watching for steam controllers.
     */
    public startWatching() {
        if (!this.watcher.isWatching) {
            this.watcher.isWatching = true;
            this.watcherEvents = SteamHidDevice.onListChange.subscribe(() => this.watcherCallback());
            SteamHidDevice.startMonitoring();
            this.watcherCallback();
        }
    }

    /**
     * Stop watching for steam controllers.
     */
    public stopWatching() {
        if (this.watcher.isWatching) {
            this.watcher.isWatching = false;
            this.watcherEvents.unsubscribe();
            SteamHidDevice.stopMonitoring();
        }
    }

    public reportToDualshockReport(report: SteamDeviceReport) {
        return this.isOpen() ? this.device!.reportToDualshockReport(report) : null;
    }

    public reportToDualshockMeta(report: SteamDeviceReport, padId: number) {
        return this.isOpen() ? this.device!.reportToDualshockMeta(report, padId) : null;
    }

    /**
     * Watcher callback.
     */
    private watcherCallback() {
        try {
            if (this.watcher.timer !== null) {
                clearTimeout(this.watcher.timer);
                this.watcher.timer = null;
            }
    
            if (this.watcher.isWatching && !this.isOpen() && !this.open().isOpen()) {
                this.watcher.timer = setTimeout(() => this.watcherCallback(), 1000);
            }
        } catch (error) {
            getInternals(this).errorSubject.next(error);
        }
    }
}
