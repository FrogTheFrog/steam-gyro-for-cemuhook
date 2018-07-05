import { get } from "lodash";
import * as long from "long";
import * as microtime from "microtime";
import { Device as HidDevice, devices as hidDevices, HID } from "node-hid";
import { Subject } from "rxjs";
import { SteamDeviceMinValues } from "../../models/const/steam-device.const";
import {
    BluetoothProductId, VendorId,
    WiredProductId, WirelessProductId,
} from "../../models/const/steam-hid-device.const";
import { DualshockBattery } from "../../models/enum/dualshock-battery.enum";
import { DualshockConnection } from "../../models/enum/dualshock-connection.enum";
import { DualshockModel } from "../../models/enum/dualshock-model.enum";
import { DualshockState } from "../../models/enum/dualshock-state.enum";
import { SteamDeviceState } from "../../models/enum/steam-device-state.enum";
import { DualshockMeta } from "../../models/interface/dualshock-meta.interface";
import { DualshockReport } from "../../models/interface/dualshock-report.interface";
import { GenericDeviceEvents } from "../../models/interface/generic-device-events.interface";
import { MotionData } from "../../models/interface/motion-data.interface";
import { SteamDeviceReport } from "../../models/interface/steam-device-report.interface";
import { SteamHidDeviceStaticEvents } from "../../models/interface/steam-hid-device-static-events.interface";
import { GenericEvent } from "../../models/type/generic-event.type";
import { emptySteamDeviceReport } from "./empty-reports";
import GenericDevice from "./generic-device";
import SteamHidDeviceFeatureArray from "./steam-hid-device-feature-array";
import FeatureArray from "./steam-hid-device-feature-array";

// tslint:disable-next-line:no-var-requires
const usbDetect = require("usb-detection");
// tslint:disable-next-line:no-var-requires
const randomMac = require("random-mac");

function bool(value: number) {
    return value !== 0;
}

enum HidEvent {
    DataUpdate = 0x3c01,
    ConnectionUpdate = 0x0103,
    BatteryUpdate = 0x0b04,
}

type DeviceType = "wireless" | "wired" | "bluetooth";

interface Item {
    info: HidDevice;
    type: DeviceType;
    active: boolean;
    device: SteamHidDevice | null;
}

export default class SteamHidDevice extends GenericDevice {
    static get staticEvents() {
        return this.staticEventSubject.asObservable();
    }

    public static startMonitoring() {
        if (this.motoringCallCount++ === 0) {
            this.updateDeviceList(0, "wired", "wireless");

            // Dongle devices can be connected using usb events
            usbDetect.on(
                `change:${VendorId}:${WirelessProductId}`,
                () => this.updateDeviceList(1000, "wireless"),
            );
            usbDetect.on(
                `change:${VendorId}:${WiredProductId}`,
                () => this.updateDeviceList(1000, "wired"),
            );

            // Bluetooth devices do not emit usb event and instead
            // of introducing an OS limited BLE dependency, we are
            // pooling for bluetooth devices only
            
            const watchBluetooth = () => {
                this.updateDeviceList(0, "bluetooth");
                SteamHidDevice.timer = global.setTimeout(watchBluetooth, 5000);
            };
            watchBluetooth();
        }
    }

    public static stopMonitoring() {
        if (--this.motoringCallCount === 0) {
            usbDetect.stopMonitoring();
            if (SteamHidDevice.timer !== null){
                clearTimeout(SteamHidDevice.timer);
                SteamHidDevice.timer = null;
            }
        }
    }

    public static enumerateDevices(activeOnly: boolean = false) {
        const devices: string[] = [];

        if (activeOnly) {
            this.updateWirelessStatus();
        }

        for (const [path, item] of this.itemList) {
            if (item.device === null) {
                if ((activeOnly && item.active) || !activeOnly) {
                    devices.push(path);
                }
            }
        }

        return devices;
    }

    private static timer: NodeJS.Timer | null = null;
    private static itemList = new Map<string, Item>();
    private static deviceList: HidDevice[] | null = null;
    private static motoringCallCount: number = 0;
    private static staticEventSubject = new Subject<GenericEvent<SteamHidDeviceStaticEvents>>();

    private static updateDeviceList(delay: number, ...types: DeviceType[]) {
        const refresh = () => {
            this.deviceList = hidDevices();
            this.refreshItemList(...types);
        };

        if (delay > 0){
            setTimeout(refresh, delay);
        }
        else {
            refresh();
        }
    }

    private static getDevices(settings?: {
        devices?: HidDevice[],
        filter?: (device: HidDevice) => boolean,
        sort?: (a: HidDevice, b: HidDevice) => number,
    }) {
        let devices = get(settings, "settings.devices", this.deviceList || []) as HidDevice[];

        if (settings) {
            if (settings.filter) {
                devices = devices.filter(settings.filter);
            }

            if (settings.sort) {
                devices = devices.sort(settings.sort);
            }
        }

        return devices;
    }

    private static refreshItemList(...types: DeviceType[]) {
        const allDevices = this.getDevices();
        let listChanged = false;

        const filterDevices = (devices: HidDevice[], type: DeviceType) => {
            for (const device of devices) {
                if (device.path) {
                    if (!this.itemList.has(device.path)) {
                        this.itemList.set(device.path, {
                            active: type !== "wireless",
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
                case "wireless":
                    devices = this.getDevices({
                        devices: allDevices,
                        filter: (device) => {
                            return device.productId === WirelessProductId && device.vendorId === VendorId &&
                                device.interface > 0 && device.interface < 5 &&
                                device.usagePage === 0xFF00;
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
                            return device.productId === WiredProductId && device.vendorId === VendorId &&
                                device.interface > 0 && device.interface < 5 &&
                                device.usagePage === 0xFF00;
                        },
                        sort: (a, b) => {
                            return a.interface > b.interface ? 1 : 0;
                        },
                    });
                case "bluetooth":
                    devices = this.getDevices({
                        devices: allDevices,
                        filter: (device) => {
                            return device.productId === BluetoothProductId && device.vendorId === VendorId &&
                                device.interface === -1 && device.usagePage === 0xFF00;
                        },
                    });
                default:
                    break;
            }
            if (devices !== null) {
                filterDevices(devices, type);
                if (type === "wireless") {
                    this.updateWirelessStatus();
                }
            }
        }

        if (listChanged) {
            this.staticEventSubject.next({ event: "listChanged", value: void 0 });
        }
    }

    private static updateWirelessStatus() {
        const wirelessStateCheck = new FeatureArray(0xB4).array;

        for (const [path, item] of this.itemList) {
            try {
                if (item.type === "wireless") {
                    const device = (item.device !== null ? item.device.hidDevice : null) || new HID(path);
                    device.sendFeatureReport(wirelessStateCheck);

                    const data = device.getFeatureReport(wirelessStateCheck[0], wirelessStateCheck.length);
                    item.active = data[2] > 0 && data[3] === 2;
                }
                // tslint:disable-next-line:no-empty
            } catch (everything) { } // In case HID devices are disconnected
        }
    }

    private report = emptySteamDeviceReport();
    private rawMotionData: MotionData = { accelerometer: { x: 0, y: 0, z: 0 }, gyro: { x: 0, y: 0, z: 0 } };
    private connectionTimestamp: number = 0;
    private lastValidSensorPacket: number = 0;
    private hidDevice: HID | null = null;
    private eventSubject = new Subject<GenericEvent<GenericDeviceEvents & { report: SteamDeviceReport }>>();

    public get rawReport() {
        return this.report;
    }

    public get motionData() {
        return this.report;
    }

    public open() {
        this.close();

        const devices = SteamHidDevice.enumerateDevices(true);
        if (devices.length > 0) {
            const devicePath = devices[0];
            if (SteamHidDevice.itemList.has(devicePath)) {
                const item = SteamHidDevice.itemList.get(devicePath) as Item;
                if (item.device === null) {
                    this.hidDevice = new HID(devicePath);
                    this.hidDevice.on("data", (data: Buffer) => {
                        if (this.parseRawData(data)) {
                            this.eventSubject.next({ event: "report", value: this.report });
                            this.eventSubject.next({ event: "motionData", value: this.motionData });
                        }
                    });
                    this.hidDevice.on("closed", () => this.close());
                    this.hidDevice.on("error", (error: Error) => {
                        if (error.message === "could not read from HID device") {
                            this.close();
                        }
                        else {
                            this.eventSubject.next({ event: "error", value: error });
                        }
                    });
                    item.device = this;
                }
            }
        }

        return this;
    }

    public close() {
        if (this.isOpen()) {
            this.hidDevice!.close();
            this.hidDevice = null;
            for (const [path, item] of SteamHidDevice.itemList) {
                if (item.device === this) {
                    item.device = null;
                    break;
                }
            }

            this.eventSubject.next({ event: "close", value: void 0 });
        }
        return this;
    }

    public isOpen() {
        return this.hidDevice !== null;
    }

    public get events() {
        return this.eventSubject.asObservable();
    }

    public reportToDualshockReport(report: SteamDeviceReport): DualshockReport {
        return {
            packetCounter: report.packetCounter,
            // tslint:disable-next-line:object-literal-sort-keys
            motionTimestamp: long.fromNumber(report.timestamp, true),
            button: {
                R1: report.button.RS,
                // tslint:disable-next-line:object-literal-sort-keys
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
                    // tslint:disable-next-line:object-literal-sort-keys
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
                // tslint:disable-next-line:object-literal-sort-keys
                L2: report.trigger.RIGHT,
            },
            accelerometer: {
                x: -report.accelerometer.x,
                y: -report.accelerometer.z,
                z: report.accelerometer.y,
            },
            gyro: {
                x: report.gyro.x,
                y: -report.gyro.z,
                z: -report.gyro.y,
            },
            trackPad: {
                first: {
                    isActive: false,
                    // tslint:disable-next-line:object-literal-sort-keys
                    id: 0,
                    x: 0,
                    y: 0,
                },
                second: {
                    isActive: false,
                    // tslint:disable-next-line:object-literal-sort-keys
                    id: 0,
                    x: 0,
                    y: 0,
                },
            },
        };
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

    private toDualshockPosition(int16Value: number) {
        return Math.floor((int16Value + 32768) * 255 / 65535);
    }

    private parseRawData(data: Buffer) {
        if (data.length === 64) { // Handle data received dongle
            const time = microtime.now();
            const report = this.report;
            let event: number;
            let index = 0;

            index += 2; // skip reading id (or something else)

            event = data.readUInt16LE(index, true);
            index += 2;

            if (event === HidEvent.DataUpdate) {
                let leftPadReading: boolean;
                let preserveData: boolean;
                let buttonData: number;

                report.state = SteamDeviceState.Connected;
                report.timestamp = time - this.connectionTimestamp;

                report.packetCounter = data.readUInt32LE(index, true);
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
                    report.position.leftPad.x = data.readInt16LE(index, true);
                    index += 2;
                    report.position.leftPad.y = data.readInt16LE(index, true);

                    if (!preserveData) {
                        report.position.stick.x = 0;
                        report.position.stick.y = 0;
                    }
                }
                else {
                    report.position.stick.x = data.readInt16LE(index, true);
                    index += 2;
                    report.position.stick.y = data.readInt16LE(index, true);

                    if (!preserveData) {
                        report.position.leftPad.x = 0;
                        report.position.leftPad.y = 0;
                    }
                }
                index += 2;

                report.position.rightPad.x = data.readInt16LE(index, true);
                index += 2;
                report.position.rightPad.y = data.readInt16LE(index, true);
                index += 2;

                index += 4; // padding?

                report.accelerometer.x = data.readInt16LE(index, true) * SteamDeviceMinValues.accelerometer;
                index += 2;
                report.accelerometer.y = data.readInt16LE(index, true) * SteamDeviceMinValues.accelerometer;
                index += 2;
                report.accelerometer.z = data.readInt16LE(index, true) * SteamDeviceMinValues.accelerometer;
                index += 2;

                report.gyro.x = data.readInt16LE(index, true) * SteamDeviceMinValues.gyro;
                index += 2;
                report.gyro.y = data.readInt16LE(index, true) * SteamDeviceMinValues.gyro;
                index += 2;
                report.gyro.z = data.readInt16LE(index, true) * SteamDeviceMinValues.gyro;
                index += 2;

                report.quaternion.x = data.readInt16LE(index, true) * SteamDeviceMinValues.quaternion;
                index += 2;
                report.quaternion.y = data.readInt16LE(index, true) * SteamDeviceMinValues.quaternion;
                index += 2;
                report.quaternion.z = data.readInt16LE(index, true) * SteamDeviceMinValues.quaternion;
                index += 2;
                report.quaternion.w = data.readInt16LE(index, true) * SteamDeviceMinValues.quaternion;

                if (this.isSensorDataStuck(this.rawMotionData, report, report.packetCounter)) {
                    this.enableSensors();
                }

                this.rawMotionData.accelerometer = report.accelerometer;
                this.rawMotionData.gyro = report.gyro;
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
                report.battery = data.readInt16LE(index, true);
            }
            else { // unknown event
                return false;
            }
            return true;
        }
        else { // Handle event based data
            const toHex = (buffer: Buffer) => {
                let output = `Buffer[${buffer.length}]:`;
                for (const byte of buffer) {
                    output += " 0" + byte.toString(16).slice(-2);
                }
                return output;
            };

            // tslint:disable-next-line:no-console
            console.log(toHex(data));

            return false;
        }
    }

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

    private enableSensors() {
        if (this.isOpen()) {
            try {
                const gyro = 0x10;
                const accelerometer = 0x08;
                const quaternion = 0x04;
                const featureArray = new SteamHidDeviceFeatureArray();
                featureArray.setUint16(0x30, gyro | accelerometer | quaternion);
                this.hidDevice!.sendFeatureReport(featureArray.array);
                // tslint:disable-next-line:no-empty
            } catch (everything) { }
        }
    }
}
