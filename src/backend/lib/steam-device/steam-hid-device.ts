import * as long from "long";
import * as microtime from "microtime";
import { Device as HidDevice, devices as hidDevices, HID } from "node-hid";
import { Subject } from "rxjs";
import * as usbDetect from "usb-detection";
import { privateData } from "../../../shared/lib";
import { MotionData, MotionDataWithTimestamp } from "../../../shared/models";
import {
    DualshockBattery,
    DualshockConnection,
    DualshockMeta,
    DualshockModel,
    DualshockReport,
    DualshockState,
    GenericSteamDevice,
    SteamDeviceRatios,
    SteamDeviceReport,
    SteamDeviceScales,
    SteamDeviceState,
    SteamHidId,
} from "../../models";
import { emptySteamDeviceReport } from "./empty-report";
import { HidFeatureArray } from "./hid-feature-array";

/**
 * Shorthand function for converting number to boolean.
 * @param value Value to convert to.
 * @returns Boolean representation of a given value.
 */
function bool(value: number) {
    return value !== 0;
}

/**
 * Hid event types.
 */
const enum HidEvent {
    DataUpdate = 0x3c01,
    ConnectionUpdate = 0x0103,
    BatteryUpdate = 0x0b04,
}

/**
 * Possible HID device types.
 */
type DeviceType = "dongle" | "wired";

/**
 * Interface for storing HID devices.
 */
interface Item {
    info: HidDevice;
    type: DeviceType;
    active: boolean;
    device: SteamHidDevice | null;
}

/**
 * Internal class data interface.
 */
interface InternalData {
    errorSubject: Subject<Error>;
    infoString: string | null;
    motionDataSubject: Subject<MotionDataWithTimestamp>;
    openCloseSubject: Subject<{ info: string, status: boolean }>;
    reportSubject: Subject<SteamDeviceReport>;
}

/**
 * Event handler for list change events.
 */
const listChangeSubject = new Subject<void>();

/**
 * Private data getter.
 */
const getInternals = privateData() as (self: SteamHidDevice, init: InternalData | void) => InternalData;

/**
 * Class for handling HID based steam devices.
 */
export class SteamHidDevice extends GenericSteamDevice {
    /**
     * Array containing all supported device types.
     */
    public static allTypes: DeviceType[] = ["wired", "dongle"];

    /**
     * Returns list change event observable.
     */
    public static get onListChange() {
        return listChangeSubject.asObservable();
    }

    /**
     * Starts monitoring for new HID devices.
     */
    public static startMonitoring() {
        if (this.motoringCallCount++ === 0) {
            this.updateDeviceList(0, ...this.allTypes);

            // Dongle devices can be connected using usb events
            usbDetect.on(
                `change:${SteamHidId.Vendor}:${SteamHidId.DongleProduct}`,
                () => this.updateDeviceList(1000, "dongle"),
            );
            usbDetect.on(
                `change:${SteamHidId.Vendor}:${SteamHidId.WiredProduct}`,
                () => this.updateDeviceList(1000, "wired"),
            );

            usbDetect.startMonitoring();
        }
    }

    /**
     * Stops monitoring for new HID devices.
     */
    public static stopMonitoring() {
        if (--this.motoringCallCount === 0) {
            usbDetect.stopMonitoring();
        }
    }

    /**
     * Enumerate currently available devices.
     * @param activeOnly Exclude inactive devices.
     * @returns Array of device system paths.
     */
    public static enumerateDevices(activeOnly: boolean = false) {
        const devices: string[] = [];

        if (activeOnly) {
            this.updateDongleStatus();
        }

        for (const [path, item] of this.itemList) {
            if (item.device === null) {
                if (((activeOnly && item.active) || !activeOnly) && !this.blacklistedDevices.has(path)) {
                    devices.push(path);
                }
            }
        }

        return devices;
    }

    /**
     * Stored item list.
     */
    private static itemList = new Map<string, Item>();

    /**
     * Temporary blacklisted devices in case they might have been disconnected.
     */
    private static blacklistedDevices = new Set<string>();

    /**
     * Stored device array.
     */
    private static deviceList: HidDevice[] | null = null;

    /**
     * Call count tracker to prevent running multiple trackers.
     */
    private static motoringCallCount: number = 0;

    /**
     * Update device list.
     * @param delay Delay interval before updating.
     * @param types Types to be include in updated list.
     */
    private static updateDeviceList(delay: number, ...types: DeviceType[]) {
        const refresh = () => {
            this.deviceList = hidDevices();
            this.refreshItemList(...types);
        };

        if (delay > 0) {
            setTimeout(refresh, delay);
        } else {
            refresh();
        }
    }

    /**
     * Shorthand function for filtering and sorting device array.
     * @param options Options for this method.
     * @return Device array after filtering and sorting.
     */
    private static getDevices(options?: {
        devices?: HidDevice[],
        filter?: (device: HidDevice) => boolean,
        sort?: (a: HidDevice, b: HidDevice) => number,
    }) {
        let { devices = this.deviceList || [] } = options || {};

        if (options) {
            if (devices.length > 0 && options.filter) {
                devices = devices.filter(options.filter);
            }

            if (devices.length > 0 && options.sort) {
                devices = devices.sort(options.sort);
            }
        }

        return devices;
    }

    /**
     * Refresh item list.
     * @param types Types to keep in refreshed list.
     */
    private static refreshItemList(...types: DeviceType[]) {
        const allDevices = this.getDevices();
        let listChanged = false;

        const osSpecificFilter = (device: HidDevice, type: DeviceType) => {
            if (process.platform === "win32") {
                return device.usagePage === 0xFF00;
            }
            else {
                return type === "wired" ? device.interface === 1 : true;
            }
        };

        const filterDevices = (devices: HidDevice[], type: DeviceType) => {
            for (const device of devices) {
                if (device.path) {
                    if (!this.itemList.has(device.path)) {
                        this.itemList.set(device.path, {
                            active: type !== "dongle",
                            device: null,
                            info: device,
                            type,
                        });
                        listChanged = true;
                    }
                }
            }

            for (const [path, item] of this.itemList) {
                if (item.type === type) {
                    const hasDevice = devices.findIndex((device) => device.path === path) !== -1;
                    if (!hasDevice) {
                        if (item.device) {
                            item.device.close();
                        }
                        this.itemList.delete(path);
                        listChanged = true;
                    }
                }
            }

            return listChanged;
        };

        for (const type of types) {
            let devices: HidDevice[] | null = null;
            switch (type) {
                case "dongle":
                    devices = this.getDevices({
                        devices: allDevices,
                        filter: (device) => {
                            return device.productId === SteamHidId.DongleProduct &&
                                device.vendorId === SteamHidId.Vendor &&
                                device.interface > 0 && device.interface < 5 &&
                                osSpecificFilter(device, type);
                        },
                        sort: (a, b) => {
                            return a.interface > b.interface ? 1 : 0;
                        },
                    });
                    break;
                case "wired":
                    devices = this.getDevices({
                        devices: allDevices,
                        filter: (device) => {
                            return device.productId === SteamHidId.WiredProduct &&
                                device.vendorId === SteamHidId.Vendor &&
                                device.interface > 0 && device.interface < 5 &&
                                osSpecificFilter(device, type);
                        },
                        sort: (a, b) => {
                            return a.interface > b.interface ? 1 : 0;
                        },
                    });
                    break;
            }
            if (devices !== null) {
                filterDevices(devices, type);
                if (type === "dongle") {
                    this.updateDongleStatus();
                }
            }
        }

        if (listChanged) {
            listChangeSubject.next();
        }
    }

    private static updateDongleStatus() {
        const wirelessStateCheck = new HidFeatureArray(0xB4).array;

        for (const [path, item] of this.itemList) {
            try {
                if (item.type === "dongle") {
                    const device = (item.device !== null ? item.device.hidDevice : null) || new HID(path);
                    device.sendFeatureReport(wirelessStateCheck);

                    const data = device.getFeatureReport(wirelessStateCheck[0], wirelessStateCheck.length);
                    item.active = data[2] > 0 && data[3] === 2;
                }
                // tslint:disable-next-line:no-empty
            } catch (everything) { } // In case HID devices are disconnected
        }
    }

    /**
     * Current steam device report.
     */
    private currentReport = emptySteamDeviceReport();

    /**
     * Motion data.
     */
    private currentMotionData: MotionDataWithTimestamp =
        {
            accelerometer: {
                range: [-SteamDeviceScales.Accelerometer, SteamDeviceScales.Accelerometer],
                x: 0,
                y: 0,
                z: 0,
            },
            gyro: {
                range: [-SteamDeviceScales.Gyro, SteamDeviceScales.Gyro],
                x: 0,
                y: 0,
                z: 0,
            },
            timestamp: 0,
        };

    /**
     * Last active connection timestamp.
     */
    private connectionTimestamp: number = 0;

    /**
     * Holds last packet number with valid motion data.
     */
    private lastValidSensorPacket: number = 0;

    /**
     * Current HID device.
     */
    private hidDevice: HID | null = null;

    constructor() {
        super();
        getInternals(this, {
            errorSubject: new Subject(),
            infoString: null,
            motionDataSubject: new Subject(),
            openCloseSubject: new Subject(),
            reportSubject: new Subject(),
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
        return this.currentReport;
    }

    public get motionData() {
        return this.currentMotionData;
    }

    public open() {
        this.close();

        const devices = SteamHidDevice.enumerateDevices(true);
        if (devices.length > 0) {
            const pd = getInternals(this);
            const devicePath = devices[0];
            if (SteamHidDevice.itemList.has(devicePath)) {
                const item = SteamHidDevice.itemList.get(devicePath) as Item;
                if (item.device === null) {
                    this.hidDevice = new HID(devicePath);

                    this.hidDevice.on("data", (data: Buffer) => {
                        if (this.parseRawData(data)) {
                            pd.reportSubject.next(this.currentReport);
                            pd.motionDataSubject.next(this.motionData);
                        }
                    });
                    this.hidDevice.on("error", (error: Error) => {
                        if (error.message === "could not read from HID device") {
                            // It is possible that device has been physically disconnected, we should
                            // try to handle this gracefully
                            SteamHidDevice.blacklistedDevices.add(devicePath);
                            setTimeout(() => {
                                SteamHidDevice.blacklistedDevices.delete(devicePath);
                            }, 3000);

                            this.close();
                        } else {
                            pd.errorSubject.next(error);
                        }
                    });

                    item.device = this;
                    pd.infoString = JSON.stringify(item.info, undefined, "    ");
                    this.connectionTimestamp = microtime.now();
                    pd.openCloseSubject.next({ info: pd.infoString, status: true });
                }
            }
        }

        return this;
    }

    public close() {
        if (this.isOpen()) {
            const pd = getInternals(this);
            const info = pd.infoString!;

            this.hidDevice!.close();
            this.hidDevice = null;
            pd.infoString = null;

            for (const [path, item] of SteamHidDevice.itemList) {
                if (item.device === this) {
                    item.device = null;
                    break;
                }
            }

            pd.openCloseSubject.next({ info, status: false });
        }
        return this;
    }

    public isOpen() {
        return this.hidDevice !== null;
    }

    public reportToDualshockReport(report: SteamDeviceReport): DualshockReport {
        // tslint:disable:object-literal-sort-keys
        return {
            packetCounter: report.packetCounter,
            motionTimestamp: long.fromNumber(report.timestamp, true),
            button: {
                R1: report.button.RS,
                L1: report.button.LS,
                R2: report.button.RT,
                L2: report.button.LT,
                R3: report.button.rightPad,
                L3: report.button.stick,
                PS: report.button.steam,
                SQUARE: report.button.X,
                CROSS: report.button.A,
                CIRCLE: report.button.B,
                TRIANGLE: report.button.Y,
                options: report.button.next,
                share: report.button.previous,
                dPad: {
                    UP: report.button.dPad.UP,
                    RIGHT: report.button.dPad.RIGHT,
                    LEFT: report.button.dPad.LEFT,
                    DOWN: report.button.dPad.DOWN,
                },
                touch: false,
            },
            position: {
                left: {
                    x: this.toDualshockPosition(report.position.stick.x),
                    y: this.toDualshockPosition(report.position.stick.y),
                },
                right: {
                    x: this.toDualshockPosition(report.position.rightPad.x),
                    y: this.toDualshockPosition(report.position.rightPad.y),
                },
            },
            trigger: {
                R2: report.trigger.LEFT,
                L2: report.trigger.RIGHT,
            },
            accelerometer: {
                range: [-SteamDeviceScales.Accelerometer, SteamDeviceScales.Accelerometer],
                x: -report.accelerometer.x,
                y: -report.accelerometer.z,
                z: report.accelerometer.y,
            },
            gyro: {
                range: [-SteamDeviceScales.Gyro, SteamDeviceScales.Gyro],
                x: report.gyro.x,
                y: -report.gyro.z,
                z: -report.gyro.y,
            },
            trackPad: {
                first: {
                    isActive: false,
                    id: 0,
                    x: 0,
                    y: 0,
                },
                second: {
                    isActive: false,
                    id: 0,
                    x: 0,
                    y: 0,
                },
            },
        };
        // tslint:enable:object-literal-sort-keys
    }

    public reportToDualshockMeta(report: SteamDeviceReport, padId: number): DualshockMeta {
        return {
            batteryStatus: DualshockBattery.None,
            connectionType: DualshockConnection.Usb,
            isActive: microtime.now() - report.timestamp < 1000000,
            macAddress: report.macAddress,
            model: DualshockModel.DS4,
            padId,
            state: report.state === SteamDeviceState.Connected
                ? DualshockState.Connected : DualshockState.Disconnected,
        };
    }

    /**
     * Convert Steam Controller's position to Dualshock compatible position.
     * @param int16Value Value to convert.
     * @returns Dualshock compatible position value.
     */
    private toDualshockPosition(int16Value: number) {
        return Math.floor((int16Value + 32768) * 255 / 65535);
    }

    /**
     * Parses raw HID input and updates current report.
     * @param data Data to parser.
     */
    private parseRawData(data: Buffer) {
        const time = microtime.now();
        const report = this.currentReport;
        let event: number;
        let index = 0;

        index += 2; // skip reading id (or something else)

        event = data.readUInt16LE(index);
        index += 2;

        if (event === HidEvent.DataUpdate) {
            let leftPadReading: boolean;
            let preserveData: boolean;
            let buttonData: number;

            report.state = SteamDeviceState.Connected;
            report.timestamp = time - this.connectionTimestamp;

            if (report.timestamp < 0) {
                this.connectionTimestamp = time;
                report.timestamp = 0;
            }

            report.packetCounter = data.readUInt32LE(index);
            index += 4;

            buttonData = data[index++];
            report.button.RT = bool(buttonData & 0x01);
            report.button.LT = bool(buttonData & 0x02);
            report.button.RS = bool(buttonData & 0x04);
            report.button.LS = bool(buttonData & 0x08);
            report.button.Y = bool(buttonData & 0x10);
            report.button.B = bool(buttonData & 0x20);
            report.button.X = bool(buttonData & 0x40);
            report.button.A = bool(buttonData & 0x80);

            buttonData = data[index++];
            report.button.dPad.UP = bool(buttonData & 0x01);
            report.button.dPad.RIGHT = bool(buttonData & 0x02);
            report.button.dPad.LEFT = bool(buttonData & 0x04);
            report.button.dPad.DOWN = bool(buttonData & 0x08);
            report.button.previous = bool(buttonData & 0x10);
            report.button.steam = bool(buttonData & 0x20);
            report.button.next = bool(buttonData & 0x40);
            report.button.grip.LEFT = bool(buttonData & 0x80);

            buttonData = data[index++];
            preserveData = bool(buttonData & 0x80);
            leftPadReading = bool(buttonData & 0x08);

            report.button.grip.RIGHT = bool(buttonData & 0x01);
            report.button.rightPad = bool(buttonData & 0x04);
            report.button.stick = bool(buttonData & 0x40) || (preserveData ? report.button.stick : false);
            report.touch.leftPad = leftPadReading || (preserveData ? report.touch.leftPad : false);
            report.touch.rightPad = bool(buttonData & 0x10);

            report.trigger.LEFT = data[index++];
            report.trigger.RIGHT = data[index++];

            index += 3; // padding?

            if (leftPadReading) {
                report.position.leftPad.x = data.readInt16LE(index);
                index += 2;
                report.position.leftPad.y = data.readInt16LE(index);

                if (!preserveData) {
                    report.position.stick.x = 0;
                    report.position.stick.y = 0;
                }
            }
            else {
                report.position.stick.x = data.readInt16LE(index);
                index += 2;
                report.position.stick.y = data.readInt16LE(index);

                if (!preserveData) {
                    report.position.leftPad.x = 0;
                    report.position.leftPad.y = 0;
                }
            }
            index += 2;

            report.position.rightPad.x = data.readInt16LE(index);
            index += 2;
            report.position.rightPad.y = data.readInt16LE(index);
            index += 2;

            index += 4; // padding?

            report.accelerometer.x = data.readInt16LE(index) * SteamDeviceRatios.Accelerometer;
            index += 2;
            report.accelerometer.y = data.readInt16LE(index) * SteamDeviceRatios.Accelerometer;
            index += 2;
            report.accelerometer.z = data.readInt16LE(index) * SteamDeviceRatios.Accelerometer;
            index += 2;

            report.gyro.x = data.readInt16LE(index) * SteamDeviceRatios.Gyro;
            index += 2;
            report.gyro.y = data.readInt16LE(index) * SteamDeviceRatios.Gyro;
            index += 2;
            report.gyro.z = data.readInt16LE(index) * SteamDeviceRatios.Gyro;
            index += 2;

            report.quaternion.x = data.readInt16LE(index) * SteamDeviceRatios.Quaternion;
            index += 2;
            report.quaternion.y = data.readInt16LE(index) * SteamDeviceRatios.Quaternion;
            index += 2;
            report.quaternion.z = data.readInt16LE(index) * SteamDeviceRatios.Quaternion;
            index += 2;
            report.quaternion.w = data.readInt16LE(index) * SteamDeviceRatios.Quaternion;

            if (this.isSensorDataStuck(this.currentMotionData, report, report.packetCounter)) {
                this.enableSensors();
            }

            this.currentMotionData.accelerometer = report.accelerometer;
            this.currentMotionData.gyro = report.gyro;
            this.currentMotionData.timestamp = report.timestamp;
        }
        else if (event === HidEvent.ConnectionUpdate) {
            const connection = data[index];
            if (connection === 0x01) {
                report.state = SteamDeviceState.Disconnected;
                setImmediate(() => this.close());
            }
            else if (connection === 0x02) {
                report.state = SteamDeviceState.Connected;
            }
            else if (connection === 0x03) {
                report.state = SteamDeviceState.Pairing;
            }
        }
        else if (event === HidEvent.BatteryUpdate) {
            report.state = SteamDeviceState.Connected;

            index += 8;
            report.battery = data.readInt16LE(index);
        }
        else { // unknown event
            return false;
        }
        return true;
    }

    /**
     * Determine whether sensor data is stuck.
     * @param previousData Previous motion data.
     * @param currentData Current motion data.
     * @param packetCounter Current packet count.
     * @returns `true` if sensor is stuck.
     */
    private isSensorDataStuck(previousData: MotionData, currentData: MotionData, packetCounter: number) {
        const probablyStuck = (
            (
                previousData.accelerometer.x === currentData.accelerometer.x &&
                previousData.accelerometer.y === currentData.accelerometer.y &&
                previousData.accelerometer.z === currentData.accelerometer.z
            ) || (
                previousData.gyro.x === currentData.gyro.x &&
                previousData.gyro.y === currentData.gyro.y &&
                previousData.gyro.z === currentData.gyro.z
            )
        );

        if (probablyStuck) {
            if (packetCounter - this.lastValidSensorPacket > 200) {
                this.lastValidSensorPacket = packetCounter;
                return true;
            }
        }
        else {
            this.lastValidSensorPacket = packetCounter;
        }
        return false;
    }

    /**
     * Try to enable motion sensors.
     */
    private enableSensors() {
        if (this.isOpen()) {
            try {
                const gyro = 0x10;
                const accelerometer = 0x08;
                const quaternion = 0x04;
                const featureArray = new HidFeatureArray();
                featureArray.appendUint16(0x30, gyro | accelerometer | quaternion);
                this.hidDevice!.sendFeatureReport(featureArray.array);
                // tslint:disable-next-line:no-empty
            } catch (everything) { }
        }
    }
}
