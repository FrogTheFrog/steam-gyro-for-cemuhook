import { HID, devices as hidDevices, Device as HidDevice } from "node-hid";
import { TypedEventEmitter } from "./typed-event-emitter";
import * as _ from "lodash";
const usbDetect = require('usb-detection');

export namespace SteamDevice {
    export interface Item {
        info: HidDevice,
        type: 'wirelessConnected' | 'wirelessDisconnected' | 'wired',
        device: SteamDevice
    }

    export interface Events {
        'removed': void
    }

    export class FeatureArray {
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

    export const VendorId = 0x28DE;
    export const WirelessProductId = 0x1142;
    export const WiredProductId = 0x1102;

    export class SteamDevice extends TypedEventEmitter<Events> {
        private static itemList = new Map<string, Item>();
        private static deviceList: HidDevice[] = undefined;
        private static takenIds: number[] = [];
        private static motoringCallCount: number = 0;
        private static staticEmitter: TypedEventEmitter<{ listChange: void }> = new TypedEventEmitter();

        private hidDevice: HID = undefined;
        private deviceId: number = undefined;

        private static updateDeviceList(usbDetection: boolean = false) {
            setTimeout(() => {
                this.deviceList = hidDevices();
                this.refreshItemList();
            }, usbDetection ? 1000 : 0);
        }

        private static getDevices(settings?: { devices?: HidDevice[], filter?: (device: HidDevice) => boolean, sort?: (a: HidDevice, b: HidDevice) => number }) {
            let devices = _.get(settings, 'settings.devices', undefined) ? settings.devices : (this.deviceList || []);

            if (settings) {
                if (settings.filter)
                    devices = devices.filter(settings.filter);

                if (settings.sort)
                    devices = devices.sort(settings.sort);
            }

            return devices;
        }

        private static refreshItemList() {
            let allDevices = this.getDevices();
            let wirelessDevices = this.getDevices({
                devices: allDevices,
                filter: (device) => {
                    return device.productId === WirelessProductId && device.vendorId === VendorId &&
                        device.interface > 0 && device.interface < 5 &&
                        device.usagePage === 0xFF00
                },
                sort: (a, b) => {
                    return a.interface > b.interface ? 1 : 0;
                }
            });
            let wiredDevices = this.getDevices({
                devices: allDevices,
                filter: (device) => {
                    return device.productId === WiredProductId && device.vendorId === VendorId &&
                        device.interface > 0 && device.interface < 5 &&
                        device.usagePage === 0xFF00
                },
                sort: (a, b) => {
                    return a.interface > b.interface ? 1 : 0;
                }
            });
            let newItems = new Map<string, Item>();
            let itemsToRemove = new Map<string, Item>(this.itemList);
            let filterDevices = (devices: HidDevice[], type: 'wirelessDisconnected' | 'wired') => {
                for (let i = 0; i < devices.length; i++) {
                    let remnantDevice: Item = undefined;

                    if (itemsToRemove.has(devices[i].path)) {
                        remnantDevice = itemsToRemove.get(devices[i].path)
                        itemsToRemove.delete(devices[i].path);
                    }
                    else {
                        remnantDevice = { device: undefined, info: devices[i], type };
                    }

                    newItems.set(devices[i].path, remnantDevice);
                }
            }

            filterDevices(wirelessDevices, 'wirelessDisconnected');
            filterDevices(wiredDevices, 'wired');

            for (let [path, item] of itemsToRemove) {
                if (item.device)
                    item.device.emit('removed', void 0);
            }

            this.itemList = newItems;
            this.updateWirelessStatus();

            if (this.staticEmitter.listenerCount('listChange') > 0)
                this.staticEmitter.emit('listChange', void 0);
        }

        private static updateWirelessStatus() {
            let wirelessStateCheck = new FeatureArray(0xB4).array;

            for (let [path, item] of this.itemList) {
                try {
                    if (item.type !== 'wired') {
                        let device = (item.device !== undefined ? item.device.hidDevice : undefined) || new HID(path);
                        device.sendFeatureReport(wirelessStateCheck);
                        let data = device.getFeatureReport(wirelessStateCheck[0], wirelessStateCheck.length);
                        if (data[2] > 0 && data[3] === 2)
                            item.type = 'wirelessConnected';
                        else
                            item.type = 'wirelessDisconnected';
                    }
                } catch (everything) { } // In case HID devices are disconnected
            }
        }

        private static takeId() {
            let id = 0;

            while (true) {
                if (this.takenIds.indexOf(id) === -1) {
                    this.takenIds.push(id);
                    break;
                }
                else
                    id++;
            }

            return id;
        }

        private static freeId(id: number) {
            let index = this.takenIds.indexOf(id);
            if (index !== -1)
                this.takenIds.splice(index, 1);

            return id;
        }

        static onListChange(callback: () => void) {
            this.staticEmitter.on('listChange', callback);
        }

        static removeListChangeListener(callback: () => void) {
            this.staticEmitter.removeListener('listChange', callback);
        }

        static getAvailableDevice(activeOnly: boolean = false) {
            if (activeOnly)
                this.updateWirelessStatus();

            for (let [path, item] of this.itemList) {
                if (item.device === undefined) {
                    if (activeOnly && item.type !== 'wirelessDisconnected') {
                        item.device = new SteamDevice(path);
                        return item.device;
                    }
                }
            }

            return undefined;
        }

        static startMonitoring() {
            if (this.motoringCallCount++ === 0) {
                this.updateDeviceList(undefined);
                usbDetect.on(`change:${VendorId}:${WirelessProductId}`, () => this.updateDeviceList(true));
                usbDetect.on(`change:${VendorId}:${WiredProductId}`, () => this.updateDeviceList(true));
            }
        }

        static stopMonitoring() {
            if (this.motoringCallCount-- > 0 && this.motoringCallCount === 0) {
                usbDetect.stopMonitoring();
            }
        }

        static getList() {
            return this.itemList;
        }

        private constructor(private devicePath: string) {
            super();
            this.hidDevice = new HID(devicePath);
            this.deviceId = SteamDevice.takeId();
        }

        get hid() {
            return this.hidDevice;
        }

        get id() {
            return this.deviceId;
        }

        get info() {
            return SteamDevice.itemList.get(this.devicePath).info;
        }

        get type() {
            return SteamDevice.itemList.get(this.devicePath).type;
        }

        free() {
            this.hidDevice.close();
            if (SteamDevice.itemList.has(this.devicePath)) {
                SteamDevice.freeId(this.deviceId);
                SteamDevice.itemList.get(this.devicePath).device = undefined;
            }
        }
    }
}