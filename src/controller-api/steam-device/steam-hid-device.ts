import * as long from "long";
import * as microtime from "microtime";
import { Device as HidDevice, devices as hidDevices, HID, Device } from "node-hid";
import { Subject } from "rxjs";
import { privateData } from "../lib";
import { MotionData, MotionDataWithTimestamp } from "../models";
import {
    DeviceInfo,
    DeviceType,
    DualshockBattery,
    DualshockConnection,
    DualshockMeta,
    DualshockModel,
    DualshockReport,
    DualshockState,
    GenericDevice,
    GenericSteamDevice,
    SteamDeviceRatios,
    SteamDeviceReport,
    SteamDeviceScales,
    SteamDeviceState,
    SteamHidId,
} from "../models";
import { emptySteamDeviceReport } from "./empty-report";
import { HidFeatureArray } from "./hid-feature-array";

// tslint:disable-next-line:no-var-requires
const usbDetect = require("usb-detection");

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
 * Internal class data interface.
 */
interface InternalData {
    errorSubject: Subject<Error>;
    motionDataSubject: Subject<MotionDataWithTimestamp>;
    openCloseSubject: Subject<boolean>;
    reportSubject: Subject<SteamDeviceReport>;
}

/**
 * Private data getter.
 */
const getInternals = privateData() as (self: SteamHidDevice, init: InternalData | void) => InternalData;

/**
 * Class for handling HID based steam devices.
 */
export class SteamHidDevice extends GenericSteamDevice {

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
     * Current HID handle.
     */
    public hidHandle: HID | null = null;

    public deviceInfo: DeviceInfo;

    constructor(deviceInfo: DeviceInfo) {
        super();
        this.deviceInfo = deviceInfo;
        getInternals(this, {
            errorSubject: new Subject(),
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

    public get report() {
        return this.currentReport;
    }

    public get motionData() {
        return this.currentMotionData;
    }
    
    public get deviceType() {
        return "Steam-HID"
    }

    public async open() {
        const pd = {
            errorSubject: getInternals(this).errorSubject,
            reportSubject: getInternals(this).reportSubject,
            motionDataSubject: getInternals(this).motionDataSubject,
            openCloseSubject: getInternals(this).openCloseSubject
        }

        await this.close();
        this.hidHandle = new HID(this.deviceInfo.path);

        this.hidHandle.on("data", (data: Buffer) => {
            if (this.parseRawData(data)) {
                getInternals(this).reportSubject.next(this.currentReport);
                getInternals(this).motionDataSubject.next(this.motionData);
            }
        });
        this.hidHandle.on("closed", () => this.close());
        this.hidHandle.on("error", (error: Error) => {
            if (error.message === "could not read from HID device") {
                this.close();
            } else {
                pd.errorSubject.next(error);
            }
        });

        this.connectionTimestamp = microtime.now();
        pd.openCloseSubject.next(true);

        return this;
    }

    public async close() {
        if (this.isOpen()) {
            this.hidHandle!.close();
            this.hidHandle = null;
            getInternals(this).openCloseSubject.next(false);
        }
        return this;
    }

    public isOpen() {
        return this.hidHandle !== null;
    }

    public reportToDualshockReport(report: SteamDeviceReport): DualshockReport {
        // tslint:disable:object-literal-sort-keys
        return {
            packetCounter: report.packetCounter,
            timestamp: report.timestamp,
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
                this.close();
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
                this.hidHandle!.sendFeatureReport(featureArray.array);
                // tslint:disable-next-line:no-empty
            } catch (everything) { }
        }
    }
}
