import { HID, devices as hidDevices, Device as HidDevice } from "node-hid";
import { SteamDevice } from "./steam-device"
import { DualShock } from "./dualshock";
import * as microtime from "microtime";
import * as long from "long";
import * as _ from "lodash";
import * as dgram from "dgram";
import { userSettings } from "./settings.model";

function bool(value: number) {
    return value !== 0;
}

enum HidEvent {
    DataUpdate = 0x3c01,
    ConnectionUpdate = 0x0103,
    BatteryUpdate = 0x0b04
}

class MovingAverageFilter {
    private data: number[] = undefined;
    private index: number = 0;

    constructor(size: number = 15, initialValue: number = 0) {
        if (size > 0)
            this.data = new Array(size).fill(initialValue);
        else
            throw new RangeError('Invalid size provided. Must be above 0.')
    }

    addValue(value: number, returnAverage: boolean) {
        this.data[this.index] = value;
        if (++this.index === this.data.length)
            this.index = 0;

        if (returnAverage)
            return this.average;
    }

    get average() {
        let value = 0;
        for (let i = 0; i < this.data.length; i++)
            value += this.data[i];
        return value / this.data.length;
    }
}

export namespace SteamController {
    export interface Events extends DualShock.Events {
        open: { type: SteamDevice.Item['type'], info: SteamDevice.Item['info'] };
        connected: { type: SteamDevice.Item['type'], info: SteamDevice.Item['info'] };
        disconnected: { type: SteamDevice.Item['type'], info: SteamDevice.Item['info'] };
        SC_ReportByRef: Report;
        SC_Report: Report;
    }

    export enum State {
        Disconnected = 0x00,
        Pairing = 0x01,
        Connected = 0x02
    }

    export const scales = {
        accelerometer: 2,
        gyro: 2000.0,
        quaternion: 1
    };

    export const minValues = {
        accelerometer: scales.accelerometer / 32768.0,
        gyro: scales.gyro / 32768.0,
        quaternion: scales.quaternion / 32768.0
    };

    export interface Report {
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
            steam: boolean,
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
                steam: false,
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

    export class SteamController extends DualShock.DualShockGenericController<Events> {
        private handlingData = false;
        private report = emptySteamControllerReport();
        private steamDevice: SteamDevice.SteamDevice;
        private oldRawValues: { gyro: Report['gyro'], accelerometer: Report['accelerometer'] } = { gyro: { x: 0, y: 0, z: 0 }, accelerometer: { x: 0, y: 0, z: 0 } };
        private filterCoefficients: userSettings.type['filterCoefficients'] = { gyro: { useFilter: false, x: 1, y: 1, z: 1 }, accelerometer: { useFilter: false, x: 1, y: 1, z: 1 } };
        private filters = {
            accelerometer: {
                x: new MovingAverageFilter(),
                y: new MovingAverageFilter(),
                z: new MovingAverageFilter()
            },
            gyro: {
                x: new MovingAverageFilter(),
                y: new MovingAverageFilter(),
                z: new MovingAverageFilter()
            }
        }
        private motionSensors = {
            accelerometer: true,
            gyro: true,
            quaternion: true
        };
        private connectionTimestamp: number = 0;
        private closeOnDisconnect: boolean = false;
        private watcher = {
            activeOnly: false,
            timeoutObject: undefined as NodeJS.Timer,
            isWatching: false
        };
        private watcherCallback = () => {
            if (this.watcher.timeoutObject !== undefined) {
                clearTimeout(this.watcher.timeoutObject);
                this.watcher.timeoutObject = undefined;
            }

            if (this.watcher.isWatching && !this.open({ activeOnly: this.watcher.activeOnly }).isOpen()) {
                this.watcher.timeoutObject = global.setTimeout(this.watcherCallback.bind(this), 1000);
            }
        }

        open(options?: { activeOnly?: boolean, autoClose?: boolean, devicePath?: string, newMAC?: boolean }) {
            if (_.get(options, 'autoClose', false))
                this.close();

            if (!this.isOpen()) {
                this.steamDevice = SteamDevice.SteamDevice.getAvailableDevice(_.get(options, 'activeOnly', false), _.get(options, 'devicePath'));

                if (this.isOpen()) {
                    if (_.get(options, 'newMAC', false))
                        this.report.macAddress = require('random-mac')();

                    this.connectionTimestamp = microtime.now();

                    this.steamDevice.hid.on('data', this.handleData.bind(this));
                    this.steamDevice.hid.on("error", this.errorCallback.bind(this));
                    this.steamDevice.hid.on('closed', this.close.bind(this));
                    this.steamDevice.once('removed', this.close.bind(this));

                    this.emit('open', { type: this.steamDevice.type, info: this.steamDevice.info });
                }
            }

            return this;
        }

        isOpen() {
            return this.steamDevice !== undefined;
        }

        close() {
            if (this.isOpen()) {
                this.steamDevice.free();
                this.steamDevice = undefined;

                let mac = this.report.macAddress;
                this.report = emptySteamControllerReport();
                this.report.macAddress = mac;

                this.emit('close', void 0);
            }

            return this;
        }

        closeOnWirelessDisconnect(close: boolean) {
            this.closeOnDisconnect = close;
            return this;
        }

        startWatching(activeOnly: boolean = false) {
            this.watcher.activeOnly = activeOnly;
            if (!this.watcher.isWatching) {
                this.watcher.isWatching = true;
                SteamDevice.SteamDevice.onListChange(this.watcherCallback);
                SteamDevice.SteamDevice.startMonitoring();
                this.watcherCallback();
            }
            return this;
        }

        stopWatching() {
            if (this.watcher.isWatching) {
                this.watcher.isWatching = false;
                SteamDevice.SteamDevice.stopMonitoring();
            }
            return this;
        }

        setFilterCoefficients(coefficients: { gyro?: userSettings.type['filterCoefficients']['gyro'], accelerometer?: userSettings.type['filterCoefficients']['accelerometer'] }) {
            if (coefficients.gyro != undefined)
                this.filterCoefficients.gyro = coefficients.gyro;
            if (coefficients.accelerometer != undefined)
                this.filterCoefficients.accelerometer = coefficients.accelerometer;
        }

        setHomeButtonBrightness(percentage: number) {
            if (this.isOpen()) {
                let featureArray = new SteamDevice.FeatureArray().setUint16(0x2D, percentage < 0 ? 0 : (percentage > 100 ? 100 : Math.floor(percentage)));
                this.steamDevice.hid.sendFeatureReport(featureArray.array);
            }
        }

        enableOrientationData(settings?: { gyro?: boolean, accelerometer?: boolean, quaternion?: boolean }) {
            if (this.isOpen()) {
                if (settings !== undefined) {
                    this.motionSensors.gyro = settings.gyro;
                    this.motionSensors.accelerometer = settings.accelerometer;
                    this.motionSensors.quaternion = settings.quaternion;
                }

                let featureArray = new SteamDevice.FeatureArray();
                let value: number = 0;
                if (this.motionSensors.gyro)
                    value |= 0x10;
                if (this.motionSensors.accelerometer)
                    value |= 0x08;
                if (this.motionSensors.quaternion)
                    value |= 0x04;
                featureArray.setUint16(0x30, value);
                this.steamDevice.hid.sendFeatureReport(featureArray.array);
            }
        }

        playMelody(id: number) { // id range [0x00; 0x0F], works when Steam is closed
            if (this.isOpen()) {
                let featureArray = new SteamDevice.FeatureArray(0xB6);
                featureArray.setUint8(id & 0x0F, 0).setUint8(0, 0);
                this.steamDevice.hid.sendFeatureReport(featureArray.array);
            }
        }

        getDualShockMeta() {
            return this.isOpen() ? this.reportToDS_Meta(this.report) : undefined;
        }

        getDualShockReport() {
            return this.isOpen() ? this.reportToDS_Report(this.report) : undefined;
        }

        getSteamControllerReport(id: number) {
            return this.isOpen() ? this.report : undefined;
        }

        private errorCallback(err: any) {
            if (err.message === "could not read from HID device") {
                this.close();
            }
            else
                this.emit('error', err);
        }

        private handleData(data: Buffer) {
            let time = microtime.now();
            if (!this.handlingData) {
                this.handlingData = true;
                let updated = true;
                let report: Report = this.report;
                let index = 0;

                index += 2; //skip reading id or something

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
                    report.button.steam = bool(buttonData & 0x20);
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

                    let accelerometer: Report['accelerometer'] = { x: undefined, y: undefined, z: undefined };
                    let gyro: Report['gyro'] = { x: undefined, y: undefined, z: undefined };

                    accelerometer.x = data.readInt16LE(index, true) * minValues.accelerometer;
                    index += 2;
                    accelerometer.y = data.readInt16LE(index, true) * minValues.accelerometer;
                    index += 2;
                    accelerometer.z = data.readInt16LE(index, true) * minValues.accelerometer;
                    index += 2;

                    gyro.x = data.readInt16LE(index, true) * minValues.gyro;
                    index += 2;
                    gyro.y = data.readInt16LE(index, true) * minValues.gyro;
                    index += 2;
                    gyro.z = data.readInt16LE(index, true) * minValues.gyro;
                    index += 2;

                    report.quaternion.x = data.readInt16LE(index, true) * minValues.quaternion;
                    index += 2;
                    report.quaternion.y = data.readInt16LE(index, true) * minValues.quaternion;
                    index += 2;
                    report.quaternion.z = data.readInt16LE(index, true) * minValues.quaternion;
                    index += 2;
                    report.quaternion.w = data.readInt16LE(index, true) * minValues.quaternion;

                    if (this.filterCoefficients.accelerometer.useFilter && Math.abs(accelerometer.x - report.accelerometer.x) < scales.accelerometer * this.filterCoefficients.gyro.y /*<-something*/){
                        //IIRF
                        report.accelerometer.x += this.filterCoefficients.accelerometer.x * (accelerometer.x - report.accelerometer.x);
                        report.accelerometer.y += this.filterCoefficients.accelerometer.x * (accelerometer.y - report.accelerometer.y);
                        report.accelerometer.z += this.filterCoefficients.accelerometer.x * (accelerometer.z - report.accelerometer.z);
                    }
                    else {
                        report.accelerometer.x = accelerometer.x;
                        report.accelerometer.y = accelerometer.y;
                        report.accelerometer.z = accelerometer.z;
                    }

                    if (this.filterCoefficients.gyro.useFilter && Math.abs(accelerometer.x - report.accelerometer.x) < scales.accelerometer * this.filterCoefficients.gyro.y /*<-something*/){
                        /* //MAF
                        report.gyro.x = this.filters.gyro.x.addValue(gyro.x, true);
                        report.gyro.y = this.filters.gyro.y.addValue(gyro.y, true);
                        report.gyro.z = this.filters.gyro.z.addValue(gyro.z, true); */
                        //IIRF
                        report.gyro.x += this.filterCoefficients.gyro.x * (gyro.x - report.gyro.x);
                        report.gyro.y += this.filterCoefficients.gyro.x * (gyro.y - report.gyro.y);
                        report.gyro.z += this.filterCoefficients.gyro.x * (gyro.z - report.gyro.z);
                    }
                    else {
                        report.gyro.x = gyro.x;
                        report.gyro.y = gyro.y;
                        report.gyro.z = gyro.z;
                    }

                    if (this.isSensorDataStuck(accelerometer, gyro, report.quaternion)) {
                        try {
                            this.enableOrientationData();
                        } catch (everything) { } // In case HID device is disconnected
                    }

                    this.oldRawValues.accelerometer.x = accelerometer.x;
                    this.oldRawValues.accelerometer.y = accelerometer.y;
                    this.oldRawValues.accelerometer.z = accelerometer.z;

                    this.oldRawValues.gyro.x = gyro.x;
                    this.oldRawValues.gyro.y = gyro.y;
                    this.oldRawValues.gyro.z = gyro.z;
                }
                else if (event === HidEvent.ConnectionUpdate) {
                    let connection = data[index];
                    if (connection === 0x01) {
                        report.state = State.Disconnected;
                        if (this.closeOnDisconnect)
                            this.close();
                        else
                            this.emit('disconnected', { type: this.steamDevice.type, info: this.steamDevice.info });
                    }
                    else if (connection === 0x02) {
                        report.state = State.Connected;
                        this.emit('connected', { type: this.steamDevice.type, info: this.steamDevice.info });
                    }
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

                if (updated && this.isOpen()) {
                    let clonedReport = undefined;
                    if (this.listenerCount('DS_Report') > 0) {
                        if (clonedReport === undefined)
                            clonedReport = _.cloneDeep(report);
                        this.emit('DS_Report', { report: this.reportToDS_Report(clonedReport), meta: this.reportToDS_Meta(clonedReport) });
                    }
                    if (this.listenerCount('SC_ReportByRef') > 0) {
                        this.emit('SC_ReportByRef', report);
                    }
                    if (this.listenerCount('SC_Report') > 0) {
                        clonedReport = _.cloneDeep(report);
                        this.emit('SC_Report', clonedReport);
                    }
                }

                this.handlingData = false;
            }
        }

        private isSensorDataStuck(accelerometer: Report['accelerometer'], gyro: Report['gyro'], quaternion: Report['quaternion']) {
            return (
                (this.motionSensors.accelerometer &&
                    accelerometer.x === this.oldRawValues.accelerometer.x &&
                    accelerometer.y === this.oldRawValues.accelerometer.y &&
                    accelerometer.z === this.oldRawValues.accelerometer.z) ||
                (this.motionSensors.gyro &&
                    gyro.x === this.oldRawValues.gyro.x &&
                    gyro.y === this.oldRawValues.gyro.y &&
                    gyro.z === this.oldRawValues.gyro.z) ||
                (this.motionSensors.quaternion &&
                    quaternion.x === this.report.quaternion.x &&
                    quaternion.y === this.report.quaternion.y &&
                    quaternion.z === this.report.quaternion.z)
            );
        }

        private positionToDS_Position(int16_value: number) {
            return Math.floor((int16_value + 32768) * 255 / 65535);
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
                        DOWN: report.button.dPad.DOWN
                    },
                    touch: false
                },
                position: {
                    left: { x: this.positionToDS_Position(report.position.stick.x), y: this.positionToDS_Position(report.position.stick.y) },
                    right: { x: this.positionToDS_Position(report.position.rightPad.x), y: this.positionToDS_Position(report.position.rightPad.y) }
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

        private reportToDS_Meta(report: Report): DualShock.Meta {
            return {
                batteryStatus: DualShock.Battery.None,
                connectionType: DualShock.Connection.Usb,
                isActive: microtime.now() - report.timestamp < 1000000,
                macAddress: report.macAddress,
                model: DualShock.Model.DS4,
                padId: this.steamDevice.id,
                state: report.state === State.Connected ? DualShock.State.Connected : DualShock.State.Disconnected
            }
        }
    }
}