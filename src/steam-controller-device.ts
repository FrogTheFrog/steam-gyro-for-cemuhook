import { HID, devices as hidDevices } from "node-hid";
import { EventListener } from "./event-listener";
const usbDetect = require('usb-detection');

export class SteamControllerDevice extends EventListener {
    private static availableDevices = new Map<string, SteamControllerDevice>();
    private hidDevice: HID = undefined;
    public static onNewDevice: () => void = () => { };

    public static updateAvailableDevices() {
        let devices = hidDevices().filter(device => device.productId === 0x1142 && device.vendorId === 0x28DE && device.interface > 0 && device.interface < 5);

        let newDeviceAvailable = false;
        let availableDevices = new Map<string, SteamControllerDevice>();
        let devicesToRemove = new Map<string, SteamControllerDevice>(this.availableDevices);

        for (let i = 0; i < devices.length; i++) {
            try {
                let device = new HID(devices[i].path);
                let remnantDevice = undefined;

                if (devicesToRemove.has(devices[i].path)) {
                    remnantDevice = devicesToRemove.get(devices[i].path)
                    devicesToRemove.delete(devices[i].path);
                }
                else
                    newDeviceAvailable = true;

                availableDevices.set(devices[i].path, remnantDevice);
            } catch (error) { }
        }

        for (let [path, device] of devicesToRemove) {
            if (device)
                device.dispatchEvent('removed');
        }

        this.availableDevices = availableDevices;

        if (newDeviceAvailable && this.onNewDevice)
            this.onNewDevice();
    }

    public static getAvailableDevice() {
        for (let [path, device] of this.availableDevices) {
            if (device === undefined) {
                device = new SteamControllerDevice(path);
                this.availableDevices.set(path, device);
                return device;
            }
        }

        return undefined;
    }

    private constructor(devicePath: string) {
        super();
        this.hidDevice = new HID(devicePath);
    }

    addEventListener(event: 'removed', callback: (...data: any[]) => void) {
        super.addEventListener(event, callback);
    }

    removeEventListener(event: 'removed', callback: (...data: any[]) => void) {
        super.removeEventListener(event, callback);
    }

    get hid() {
        return this.hidDevice;
    }
}

usbDetect.on(`change:${0x28DE}:${0x1142}`, () => SteamControllerDevice.updateAvailableDevices());
SteamControllerDevice.updateAvailableDevices();