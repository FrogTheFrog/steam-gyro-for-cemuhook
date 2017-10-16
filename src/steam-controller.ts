import { HID, devices as hidDevices } from "node-hid";
import { EventListener } from "./event-listener";
import { DualShock } from "./dualshock";
import * as microtime from "microtime";
import * as long from "long";
import * as _ from "lodash";
import * as dgram from "dgram";

function bool(value: number) {
    return value !== 0;
}

enum HidEvent {
    DataUpdate = 0x3c01,
    ConnectionUpdate = 0x0103,
    BatteryUpdate = 0x0b04
}

class FeatureArray {
    dataLength: number = 0;
    data = new Buffer(62).fill(0);

    constructor(private featureId: number = 0x87) { }

    get array(): number[] {
        return [].concat([this.featureId, this.featureId, this.dataLength], ...this.data);
    }

    setUint8(setting: number, value: number) {
        this.data[this.dataLength] = setting & 0xFF;
        this.data.writeUInt8(value, this.dataLength + 1);
        this.dataLength += 2;
        return this;
    }

    setUint16(setting: number, value: number) {
        this.data[this.dataLength] = setting & 0xFF;
        this.data.writeUInt16LE(value, this.dataLength + 1);
        this.dataLength += 3;
        return this;
    }

    setUint32(setting: number, value: number) {
        this.data[this.dataLength] = setting & 0xFF;
        this.data.writeUInt32LE(value, this.dataLength + 1);
        this.dataLength += 5;
        return this;
    }
}

export namespace SteamController {
    export type InterfaceEvents = 'SC_ReportUpdate' | 'SC_Report' | DualShock.InterfaceEvents;

    export enum State {
        Disconnected = 0x00,
        Pairing = 0x01,
        Connected = 0x02
    }

    export const scales = {
        accelerometer: 1 / 16384.0,
        gyro: 2000.0 / 32768.0,
        quaternion: 1 / 32768.0
    };

    export interface Report {
        id: number,
        packetCounter: number,
        battery: number,
        timestamp: number,
        macAddress: string,
        state: State,
        button: {
            RT: boolean,
            LT: boolean,
            RS: boolean,
            LS: boolean,
            Y: boolean,
            B: boolean,
            X: boolean,
            A: boolean,
            previous: boolean,
            home: boolean,
            next: boolean,
            dPad: {
                UP: boolean,
                RIGHT: boolean,
                LEFT: boolean,
                DOWN: boolean
            },
            grip: {
                LEFT: boolean,
                RIGHT: boolean
            },
            stick: boolean,
            rightPad: boolean
        },
        touch: {
            leftPad: boolean,
            rightPad: boolean
        },
        trigger: {
            LEFT: number,
            RIGHT: number
        },
        position: {
            stick: { x: number, y: number },
            leftPad: { x: number, y: number },
            rightPad: { x: number, y: number }
        },
        accelerometer: {
            x: number,
            y: number,
            z: number
        },
        gyro: {
            x: number,
            y: number,
            z: number
        },
        quaternion: {
            x: number,
            y: number,
            z: number,
            w: number
        }
    }

    export function emptySteamControllerReport(): Report {
        return {
            id: undefined,
            packetCounter: 0,
            battery: 0,
            timestamp: 0,
            macAddress: require('random-mac')(),
            state: State.Disconnected,
            button: {
                RT: false,
                LT: false,
                RS: false,
                LS: false,
                Y: false,
                B: false,
                X: false,
                A: false,
                previous: false,
                home: false,
                next: false,
                dPad: {
                    UP: false,
                    RIGHT: false,
                    LEFT: false,
                    DOWN: false
                },
                grip: {
                    LEFT: false,
                    RIGHT: false
                },
                stick: false,
                rightPad: false
            },
            touch: {
                leftPad: false,
                rightPad: false
            },
            trigger: {
                LEFT: 0,
                RIGHT: 0
            },
            position: {
                stick: { x: 0, y: 0 },
                leftPad: { x: 0, y: 0 },
                rightPad: { x: 0, y: 0 }
            },
            accelerometer: {
                x: 0,
                y: 0,
                z: 0,
            },
            gyro: {
                x: 0,
                y: 0,
                z: 0,
            },
            quaternion: {
                x: 0,
                y: 0,
                z: 0,
                w: 0
            }
        }
    }

    export class Interface extends DualShock.Interface {
        private handlingData = false;
        private reports = new Map<number, Report>();
        private steamDevice: HID;
        private postScalers = {
            gyro: {
                x: 1,
                y: 1,
                z: 1
            },
            accelerometer: {
                x: 1,
                y: 1,
                z: 1
            }
        };
        private motionSensors = {
            accelerometer: true,
            gyro: true,
            quaternion: true
        };
        private connectionTimestamp: number = 0;

        connect(hidDevice?: HID) {
            this.disconnect();

            if (hidDevice == undefined) {
                let devices = hidDevices().filter(device =>
                    device.productId === 0x1142 && device.vendorId === 0x28DE &&
                    device.interface > 0 && device.interface < 5 &&
                    device.usagePage === 0xFF00
                ).sort((a, b) => a.interface > b.interface ? 1 : 0);

                if (devices.length > 0) {
                    let device = undefined;
                    for (let i = 0; i < devices.length; i++) {
                        device = new HID(devices[i].path);
                        let data = device.readTimeout(1000);
                        if (data.length > 0)
                            break;
                        else
                            device = undefined;
                    }
                    hidDevice = device;
                }
                else {
                    devices = hidDevices().filter(device =>
                        device.productId === 0x1102 && device.vendorId === 0x28DE &&
                        device.interface > 0 && device.interface < 5 &&
                        device.usagePage === 0xFF00
                    ).sort((a, b) => a.interface > b.interface ? 1 : 0);

                    if (devices.length > 0) {
                        let device = undefined;
                        for (let i = 0; i < devices.length; i++) {
                            device = new HID(devices[i].path);
                            let data = device.readTimeout(1000);
                            if (data.length > 0)
                                break;
                            else
                                device = undefined;
                        }
                        hidDevice = device;
                    }
                }
            }

            this.steamDevice = hidDevice;

            if (this.isValid()) {
                this.connectionTimestamp = microtime.now();

                this.steamDevice.on('data', this.handleData.bind(this));
                this.steamDevice.on("error", this.errorCallback.bind(this));
                this.steamDevice.on('closed', this.disconnect.bind(this));

                return true;
            }

            return false;
        }

        setPostScalers(scalers: { gyro?: { x: number, y: number, z: number }, accelerometer?: { x: number, y: number, z: number } }) {
            if (scalers.gyro != undefined)
                this.postScalers.gyro = scalers.gyro;
            if (scalers.accelerometer != undefined)
                this.postScalers.accelerometer = scalers.accelerometer;
        }

        isValid() {
            return this.steamDevice !== undefined;
        }

        disconnect() {
            if (this.isValid()) {
                let device = this.steamDevice;
                this.steamDevice = undefined;
                device.close();
            }
        }

        setHomeButtonBrightness(percentage: number) {
            if (this.isValid()) {
                let featureArray = new FeatureArray().setUint16(0x2D, percentage < 0 ? 0 : (percentage > 100 ? 100 : Math.floor(percentage)));
                this.steamDevice.sendFeatureReport(featureArray.array);
            }
        }

        enableOrientationData(settings?: { gyro?: boolean, accelerometer?: boolean, quaternion?: boolean }) {
            if (this.isValid()) {
                if (settings !== undefined) {
                    this.motionSensors.gyro = settings.gyro;
                    this.motionSensors.accelerometer = settings.accelerometer;
                    this.motionSensors.quaternion = settings.quaternion;
                }

                let featureArray = new FeatureArray();
                let value: number = 0;
                if (this.motionSensors.gyro)
                    value |= 0x10;
                if (this.motionSensors.accelerometer)
                    value |= 0x08;
                if (this.motionSensors.quaternion)
                    value |= 0x04;
                featureArray.setUint16(0x30, value);
                this.steamDevice.sendFeatureReport(featureArray.array);
            }
        }

        playMelody(id: number) { // id range [0x00; 0x0F]
            if (this.isValid()) {
                let featureArray = new FeatureArray(0xB6);
                featureArray.setUint8(id & 0x0F, 0).setUint8(0, 0);
                this.steamDevice.sendFeatureReport(featureArray.array);
            }
        }

        getDualShockMeta(id: number) {
            return this.reports.has(id) ? this.reportToDS_Meta(this.reports.get(id)) : undefined;
        }

        getDualShockReport(id: number) {
            return this.reports.has(id) ? this.reportToDS_Report(this.reports.get(id)) : undefined;
        }

        getSteamControllerReport(id: number) {
            return this.reports.has(id) ? this.reports.get(id) : undefined;
        }

        addEventListener(event: InterfaceEvents, callback: (...data: any[]) => void) {
            super.addEventListener(event as any, callback);
        }

        removeEventListener(event: InterfaceEvents, callback: (...data: any[]) => void) {
            super.removeEventListener(event as any, callback);
        }

        hasListeners(event: InterfaceEvents) {
            return super.hasListeners(event as any);
        }

        private errorCallback(err: any) {
            if (err.message === "could not read from HID device") {
                this.disconnect();
            }
            this.dispatchEvent('error', err);
        }

        private handleData(data: Buffer) {
            let time = microtime.now();
            if (!this.handlingData) {
                this.handlingData = true;
                let updated = true;
                let report: Report = undefined;
                let index = 0;
                let id = data.readUInt16LE(index, true) - 1;
                index += 2;

                if (this.reports.has(id))
                    report = this.reports.get(id);
                else {
                    this.reports.set(id, emptySteamControllerReport());
                    report = this.reports.get(id);
                    report.id = id;
                }

                let event = data.readUInt16LE(index, true);
                index += 2;

                if (event === HidEvent.DataUpdate) {
                    report.state = State.Connected;
                    report.timestamp = time - this.connectionTimestamp;

                    report.packetCounter = data.readUInt32LE(index, true);
                    index += 4;

                    let buttonData = data[index++];
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
                    report.button.home = bool(buttonData & 0x20);
                    report.button.next = bool(buttonData & 0x40);
                    report.button.grip.LEFT = bool(buttonData & 0x80);

                    buttonData = data[index++];
                    let preserveData = buttonData & 0x80;
                    let leftPadReading = bool(buttonData & 0x08);

                    report.button.grip.RIGHT = bool(buttonData & 0x01);
                    report.button.rightPad = bool(buttonData & 0x04);
                    report.button.stick = bool(buttonData & 0x40) || (preserveData ? report.button.stick : false);
                    report.touch.leftPad = leftPadReading || (preserveData ? report.touch.leftPad : false);
                    report.touch.rightPad = bool(buttonData & 0x10);

                    report.trigger.LEFT = data[index++];
                    report.trigger.RIGHT = data[index++];

                    index += 3; //padding

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

                    index += 4; //padding

                    report.accelerometer.x = data.readInt16LE(index, true) * scales.accelerometer * this.postScalers.accelerometer.x;
                    index += 2;
                    report.accelerometer.y = data.readInt16LE(index, true) * scales.accelerometer * this.postScalers.accelerometer.y;
                    index += 2;
                    report.accelerometer.z = data.readInt16LE(index, true) * scales.accelerometer * this.postScalers.accelerometer.z;
                    index += 2;

                    report.gyro.x = data.readInt16LE(index, true) * scales.gyro * this.postScalers.gyro.x;
                    index += 2;
                    report.gyro.y = data.readInt16LE(index, true) * scales.gyro * this.postScalers.gyro.y;
                    index += 2;
                    report.gyro.z = data.readInt16LE(index, true) * scales.gyro * this.postScalers.gyro.z;
                    index += 2;

                    report.quaternion.x = data.readInt16LE(index, true) * scales.quaternion;
                    index += 2;
                    report.quaternion.y = data.readInt16LE(index, true) * scales.quaternion;
                    index += 2;
                    report.quaternion.z = data.readInt16LE(index, true) * scales.quaternion;
                    index += 2;
                    report.quaternion.w = data.readInt16LE(index, true) * scales.quaternion;
                }
                else if (event === HidEvent.ConnectionUpdate) {
                    let connection = data[index];
                    if (connection === 0x01)
                        report.state = State.Disconnected;
                    else if (connection === 0x02)
                        report.state = State.Connected;
                    else if (connection === 0x03)
                        report.state = State.Pairing;
                }
                else if (event === HidEvent.BatteryUpdate) {
                    report.state = State.Connected;

                    index += 8;
                    report.battery = data.readInt16LE(index, true);
                }
                else { //unknown event
                    report.state = State.Connected;
                    updated = false;
                }

                if (updated) {
                    let clonedReport = undefined;
                    if (this.hasListeners('DS_Report')) {
                        if (clonedReport === undefined)
                            clonedReport = _.cloneDeep(report);
                        this.dispatchEvent('DS_Report', this.reportToDS_Report(clonedReport), this.reportToDS_Meta(clonedReport));
                    }
                    if (this.hasListeners('SC_ReportUpdate')) {
                        this.dispatchEvent('SC_ReportUpdate', report);
                    }
                    if (this.hasListeners('SC_Report')) {
                        clonedReport = _.cloneDeep(report);
                        this.dispatchEvent('SC_Report', clonedReport);
                    }
                }

                if (event === HidEvent.DataUpdate) {
                    let enableData = this.motionSensors.accelerometer && report.accelerometer.x === 0 && report.accelerometer.y === 0 && report.accelerometer.z === 0;
                    enableData = enableData || this.motionSensors.gyro && report.gyro.x === 0 && report.gyro.y === 0 && report.gyro.z === 0;
                    enableData = enableData || this.motionSensors.quaternion && report.quaternion.x === 0 && report.quaternion.y === 0 && report.quaternion.z === 0;

                    if (enableData)
                        this.enableOrientationData();
                }

                this.handlingData = false;
            }
        }

        private reportToDS_Report(report: Report): DualShock.Report {
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
                    PS: report.button.home,
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
                        DOWN: report.button.dPad.DOWN
                    },
                    touch: false
                },
                position: {
                    left: { x: report.position.stick.x, y: report.position.stick.y },
                    right: { x: report.position.rightPad.x, y: report.position.rightPad.x }
                },
                trigger: {
                    R2: report.trigger.LEFT,
                    L2: report.trigger.RIGHT
                },
                accelerometer: {
                    x: -report.accelerometer.x,
                    y: -report.accelerometer.z,
                    z: report.accelerometer.y
                },
                gyro: {
                    x: report.gyro.x,
                    y: -report.gyro.z,
                    z: -report.gyro.y
                },
                trackPad: {
                    first: {
                        isActive: false,
                        id: 0,
                        x: 0,
                        y: 0
                    },
                    second: {
                        isActive: false,
                        id: 0,
                        x: 0,
                        y: 0
                    }
                }
            };
        }

        private reportToDS_Meta(report: Report): DualShock.PadMeta {
            return {
                batteryStatus: DualShock.Battery.None,
                connectionType: DualShock.Connection.Usb,
                isActive: microtime.now() - report.timestamp < 1000000,
                macAddress: report.macAddress,
                model: DualShock.Model.DS4,
                padId: report.id,
                state: report.state === State.Connected ? DualShock.State.Connected : DualShock.State.Disconnected
            }
        }
    }
}