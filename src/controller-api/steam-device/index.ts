import { Subject, Subscription } from "rxjs";
import { privateData } from "../lib";
import { MotionDataWithTimestamp } from "../models";
import { SteamDeviceReport } from "../models";
import { SteamHidDevice } from "./steam-hid-device";
import { GenericSteamDevice, GenericDevice } from "../models";
import { DualshockData} from "../models";
import { GenericController } from "../controller";
import { debug } from "debug";

/**
 * Internal class data interface.
 */
interface InternalData {    
    dualshockDataSubject: Subject<DualshockData>;
    errorSubject: Subject<Error>;
    motionDataSubject: Subject<MotionDataWithTimestamp>;
    openCloseSubject: Subject<boolean>;
    reportSubject: Subject<SteamDeviceReport>;
    connectSubject: Subject<boolean>;
}

/**
 * Private data getter.
 */
const getInternals = privateData() as (self: SteamController, init: InternalData | void) => InternalData;

/**
 * A generic Steam Controller.
 */
export class SteamController extends GenericController<SteamDeviceReport> {
    /**
     * Currently open steam device.
     */
    public device: GenericSteamDevice;

    public id: number;


    constructor(device: GenericSteamDevice, id: number) {
        super();
        this.device = device;    
        this.id = id;
        this.setData(getInternals);
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

    public get onConnection() {
        return getInternals(this).connectSubject.asObservable();
    }


    public get onDualshockData() {
        return getInternals(this).dualshockDataSubject.asObservable();
    };

    public get report() {
        return this.device.isOpen() ? this.device.report : null;
    }

    public get motionData() {
        return this.device.isOpen() ? this.device.motionData : null;
    }

    public get controllerType(){
        return "steam";
    }

    public get deviceType() {
        return this.device.deviceType;
    }

    public async open() {
        this.close();

        //Try HID first
        if (this.device instanceof SteamHidDevice){
            await this.device.open();
            if (this.device.isOpen()){
                const pd = getInternals(this);
                pd.openCloseSubject.next(true);
    
                this.deviceEvents = new Subscription()
                    .add(this.device.onMotionsData.subscribe((value) => pd.motionDataSubject.next(value)))
                    .add(this.device.onReport.subscribe((value) => pd.reportSubject.next(value)))
                    .add(this.device.onError.subscribe((value) => pd.errorSubject.next(value)))
                    .add(this.device.onOpenClose.subscribe((value) => {
                        if (value === false) {
                            this.close();
                        }
                    }));    
            } else { //failed to open
                debug("boooo");
            }
        }
        return this;
    }

    public async close() {
        if (this.isOpen()) {
            this.deviceEvents.unsubscribe();
            await this.device.close();
            getInternals(this).openCloseSubject.next(false);
        }

        return this;
    }

    public isOpen() {
        return this.device !== null;
    }

}
