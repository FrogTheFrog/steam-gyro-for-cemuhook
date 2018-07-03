import { get } from "lodash";
import * as microtime from "microtime";
import { Device as HidDevice, devices as hidDevices, HID } from "node-hid";
import { Subject } from "rxjs";
import { SteamDeviceMinValues } from "../../models/const/steam-device.const";
import { VendorId, WiredProductId, WirelessProductId } from "../../models/const/steam-hid-device.const";
import { SteamDeviceState } from "../../models/enum/steam-device-state.enum";
import { GenericSteamDeviceEvents } from "../../models/interface/generic-steam-device-events.interface";
import { SteamDeviceReport } from "../../models/interface/steam-device-report.interface";
import { SteamHidDeviceStaticEvents } from "../../models/interface/steam-hid-device-static-events.interface";
import { GenericEvent } from "../../models/type/generic-event.type";
import GenericSteamDevice, { emptySteamDeviceReport } from "./generic-steam-device";
import FeatureArray from "./steam-hid-device-feature-array";
import SteamHidDeviceFeatureArray from "./steam-hid-device-feature-array";

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

interface Item {
    info: HidDevice;
    type: "wirelessConnected" | "wirelessDisconnected" | "wired";
    device: SteamHidDevice | null;
}

export default class SteamHidDevice extends GenericSteamDevice {
    static get staticEvents() {
        return this.staticEventSubject.asObservable();
    }

    public static startMonitoring() {
        if (this.motoringCallCount++ === 0) {
            this.updateDeviceList(false);
            usbDetect.on(`change:${VendorId}:${WirelessProductId}`, () => this.updateDeviceList(true));
            usbDetect.on(`change:${VendorId}:${WiredProductId}`, () => this.updateDeviceList(true));
        }
    }

    public static stopMonitoring() {
        if (--this.motoringCallCount === 0) {
            usbDetect.stopMonitoring();
        }
    }

    public static enumerateDevices(activeOnly: boolean = false) {
        const devices: string[] = [];

        if (activeOnly) {
            this.updateWirelessStatus();
        }

        for (const [path, item] of this.itemList) {
            if (item.device === null) {
                if ((activeOnly && item.type !== "wirelessDisconnected") || !activeOnly) {
                    devices.push(path);
                }
            }
        }

        return devices;
    }

    private static itemList = new Map<string, Item>();
    private static deviceList: HidDevice[] | null = null;
    private static motoringCallCount: number = 0;
    private static staticEventSubject = new Subject<GenericEvent<SteamHidDeviceStaticEvents>>();

    private static updateDeviceList(usbDetection: boolean = false) {
        setTimeout(() => {
            this.deviceList = hidDevices();
            this.refreshItemList();
        }, usbDetection ? 1000 : 0);
    }

    private static getDevices(settings?: {
        devices?: HidDevice[],
        filter?: (device: HidDevice) => boolean,
        sort?: (a: HidDevice, b: HidDevice) => number,
    }) {
        let devices = get(settings, "settings.devices", this.deviceList || []);

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

    private static refreshItemList() {
        const allDevices = this.getDevices();
        const wirelessDevices = this.getDevices({
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
        const wiredDevices = this.getDevices({
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
        const newItems = new Map<string, Item>();
        const itemsToRemove = new Map<string, Item>(this.itemList);
        const filterDevices = (devices: HidDevice[], type: "wirelessDisconnected" | "wired") => {
            for (const device of devices) {
                let remnantDevice: Item | null = null;

                if (device.path && itemsToRemove.has(device.path)) {
                    remnantDevice = itemsToRemove.get(device.path) || null;
                    itemsToRemove.delete(device.path);
                }
                else {
                    remnantDevice = { device: null, info: device, type };
                }

                if (device.path && remnantDevice !== null) {
                    newItems.set(device.path, remnantDevice);
                }
            }
        };

        filterDevices(wirelessDevices, "wirelessDisconnected");
        filterDevices(wiredDevices, "wired");

        for (const [path, item] of itemsToRemove) {
            const device = item.device;
            if (device) {
                device.close();
            }
        }

        this.itemList = newItems;
        this.updateWirelessStatus();

        this.staticEventSubject.next({ event: "listChanged", value: void 0 });
    }

    private static updateWirelessStatus() {
        const wirelessStateCheck = new FeatureArray(0xB4).array;

        for (const [path, item] of this.itemList) {
            try {
                if (item.type === "wirelessConnected" || item.type === "wirelessDisconnected") {
                    const device = (item.device !== null ? item.device.hidDevice : null) || new HID(path);
                    device.sendFeatureReport(wirelessStateCheck);

                    const data = device.getFeatureReport(wirelessStateCheck[0], wirelessStateCheck.length);
                    if (data[2] > 0 && data[3] === 2) {
                        item.type = "wirelessConnected";
                    }
                    else {
                        item.type = "wirelessDisconnected";
                    }
                }
                // tslint:disable-next-line:no-empty
            } catch (everything) { } // In case HID devices are disconnected
        }
    }

    private currentReport = emptySteamDeviceReport();
    private previousReport = emptySteamDeviceReport();
    private connectionTimestamp: number = 0;
    private lastValidSensorPacket: number = 0;
    private hidDevice: HID | null = null;
    private eventSubject = new Subject<GenericEvent<GenericSteamDeviceEvents>>();

    constructor() {
        super();
        const mac = randomMac();
        this.currentReport.macAddress = mac;
        this.previousReport.macAddress = mac;
    }

    public getReport(previous: boolean = false) {
        return previous ? this.previousReport : this.currentReport;
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
                            this.eventSubject.next({ event: "report", value: this.currentReport });
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

    private swapReport() {
        const report = this.previousReport;
        this.previousReport = this.currentReport;
        this.currentReport = report;
        return report;
    }

    private parseRawData(data: Buffer) {
        const time = microtime.now();
        const report = this.swapReport();
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

            if (this.isSensorDataStuck(this.previousReport, report)) {
                this.enableSensors();
            }
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
            this.swapReport();
            return false;
        }
        return true;
    }

    private isSensorDataStuck(previousReport: SteamDeviceReport, currentReport: SteamDeviceReport) {
        const probablyStuck = (
            (
                previousReport.accelerometer.x === currentReport.accelerometer.x &&
                previousReport.accelerometer.y === currentReport.accelerometer.y &&
                previousReport.accelerometer.z === currentReport.accelerometer.z
            ) || (
                previousReport.gyro.x === currentReport.gyro.x &&
                previousReport.gyro.y === currentReport.gyro.y &&
                previousReport.gyro.z === currentReport.gyro.z
            ) || (
                previousReport.quaternion.x === currentReport.quaternion.x &&
                previousReport.quaternion.y === currentReport.quaternion.y &&
                previousReport.quaternion.z === currentReport.quaternion.z &&
                previousReport.quaternion.w === currentReport.quaternion.w
            )
        );

        if (probablyStuck) {
            if (currentReport.packetCounter - this.lastValidSensorPacket > 200) {
                this.lastValidSensorPacket = currentReport.packetCounter;
                return true;
            }
        }
        else {
            this.lastValidSensorPacket = currentReport.packetCounter;
        }
        return false;
    }

    private enableSensors() {
        if (this.isOpen()) {
            const gyro = 0x10;
            const accelerometer = 0x08;
            const quaternion = 0x04;
            const featureArray = new SteamHidDeviceFeatureArray();
            featureArray.setUint16(0x30, gyro | accelerometer | quaternion);
            this.hidDevice!.sendFeatureReport(featureArray.array);
        }
    }
}
