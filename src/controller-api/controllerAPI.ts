import { privateData } from "./lib";
import { Device as HidDevice, devices as hidDevices, HID } from "node-hid";
import { Subject, Subscription } from "rxjs";
import { SteamController } from "./steam-device";
import { SteamHidDevice } from "./steam-device/steam-hid-device";
import { GenericController } from "./controller";
import {
    DeviceType,
    DeviceInfo,
    SteamHidId,
    MotionDataWithTimestamp
} from "./models";
import { HidFeatureArray } from "./steam-device/hid-feature-array";
import { debug } from "debug";

const defaultDeviceTypes: DeviceType[] = ["steam-dongle" , "steam-wired" , "ds4-bluetooth" , "ds4-wired"];

interface listChangeUpdate {
    addedControllers: Array<GenericController<MotionDataWithTimestamp>>,
    removedControllers: Array<GenericController<MotionDataWithTimestamp>>
}
/**
 * Internal class data interface.
 */
interface InternalData {
    listChangeSubject: Subject<listChangeUpdate>;
}
/**
 * Private data getter.
 */
const getInternals = privateData() as (self: ControllerMaster, init: InternalData | void) => InternalData;

export class ControllerMaster {    

    public controllerList: GenericController<MotionDataWithTimestamp>[];
    private itemList = new Map<string, DeviceInfo>();
    private hidDeviceList: HidDevice[] | null = null;
    private scanInterval: NodeJS.Timeout | null = null;
    private started: boolean = false;

    constructor() {
        this.controllerList = [];
        getInternals(this, {
            listChangeSubject: new Subject<listChangeUpdate>()
        })
    }

    public get onListChange(){
        return getInternals(this).listChangeSubject.asObservable();
    }

    public startAutoScanning(options?: {
        interval?: number
    }){
        options = options || {};
        if (!options.interval || options.interval! < 0){
            options.interval = 1000;
        }
        this.scanInterval = setInterval(()=>{
            this.scanForControllers()
        }, options.interval)

        this.started = true;
    }

    public stopAutoScanning(){
        if (this.scanInterval){
            clearInterval(this.scanInterval);
        }
        this.started = false;
    }

    /**
     * Waits for a single controller to become discovered and active, then resolves
     * with controller.
     * Rejects upon timeout.
     * @param timeout number of ms to wait before timeout
     * @return Controller handle.
     */
    public waitForSingleActiveController(timeout:number = 60000):Promise<GenericController<MotionDataWithTimestamp>>{
        return new Promise((resolve,reject)=>{
            if (this.controllerList.length === 0){
                if (!this.started){
                    this.startAutoScanning();
                }
                const abortTimeout = setTimeout(()=>{
                    subscription.unsubscribe();
                    reject("Timeout reached");
                }, timeout);
                
                const subscription = new Subscription();
                subscription.add(this.onListChange.subscribe(()=>{
                    if (abortTimeout){
                        clearTimeout(abortTimeout);
                    }
                    subscription.unsubscribe()
                    resolve(this.getFirstActiveController())
                }))
            }    
        })
    }

    public getFirstActiveController(){
        return this.controllerList[0] || null;
    }

    public async scanForControllers(delay:number = 0){
        await this.updateControllerList(delay, ...defaultDeviceTypes);
    }

    /**
     * Update device list.
     * @param delay Delay interval before updating.
     * @param types Types to be include in updated list.
     */
    private updateControllerList(delay: number, ...types: DeviceType[]) {

        return new Promise((resolve,reject)=>{
            const refresh = async () => {
                this.hidDeviceList = hidDevices();
                const changedItems = await this.refreshItemList(...types);
                const removedControllers = this.disconnectControllers(changedItems.removedItems);
                const addedControllers = this.enumerateControllers();

                if (removedControllers.length > 0 || addedControllers.length > 0){
                    getInternals(this).listChangeSubject.next({addedControllers, removedControllers});
                }
                resolve({removedControllers, addedControllers});
            };
    
            if (delay > 0) {
                setTimeout(refresh, delay);
            } else {
                refresh().then(()=>{resolve()});
            }    
        })

    }

    /**
     * Enumerate currently available controllers.
     * @returns newly added Controllers
     */
    private enumerateControllers() {
        const addedControllers = new Array<GenericController<MotionDataWithTimestamp>>();
        for (const [path, item] of this.itemList) {
            let found = this.controllerList.find(val => val.device.deviceInfo == item);
            if (!found){
                if (item.active) {
                    if (item.type == "steam-dongle" || item.type == "steam-wired"){
                        const controller = new SteamController(new SteamHidDevice(item), this.controllerList.length);
                        this.controllerList.push(controller);
                        addedControllers.push(controller);
                    } //others... 
                }
            // handle reconnect
            } else if (!found.isConnected && found.isAutoReconnect){
                found._zreconnect();
                addedControllers.push(found);
            }
        }
        return addedControllers;
    }

    /**
     * Disconnect provided items on controller list
     * @param itemsToRemove items to remove
     * @returns newly added Controllers
     */
    private disconnectControllers(itemsToDisconnect: Array<DeviceInfo>){
        const disconnectedControllers = new Array<GenericController<MotionDataWithTimestamp>>();
        
        for (const item of itemsToDisconnect){
            const path = item.path;
            this.controllerList.find((value, index)=>{
                if (value.device.deviceInfo.path === path){
                    disconnectedControllers.push(value);
                    // Close controller handle
                    value._zdisconnect();
                    //delete this.controllerList[index];
                }
            })
        }
        return disconnectedControllers;
    }

    /**
     * Shorthand function for filtering and sorting device array.
     * @param options Options for this method.
     * @return Device array after filtering and sorting.
     */
    private filterDevices(options?: {
        devices?: HidDevice[],
        filter?: (device: HidDevice) => boolean,
        sort?: (a: HidDevice, b: HidDevice) => number,
    }) {
        let { devices = this.hidDeviceList || [] } = options || {};

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

    //adds and removes devices of one specified type
    private setDevices (devices: HidDevice[], type: DeviceType){
        const addedItems = new Array<DeviceInfo>();
        const removedItems = new Array<DeviceInfo>();
        
        // Add device to list if not already exists
        for (const device of devices) {
            if (device.path) {
                if (!this.itemList.has(device.path)) {
                    this.itemList.set(device.path, {
                        // only steam dongles are not automatically active if detected.
                        active: type !== "steam-dongle",
                        path: device.path,
                        info: device,
                        type,
                    });
                    const addedItem = this.itemList.get(device.path);
                    if (addedItem != undefined){
                        addedItems.push(addedItem);
                    }
                }
            }
        }
        // Remove no longer present devices
        for (const [path, item] of this.itemList) {
            if (item.type === type) {
                const hasDevice = devices.findIndex((device) => device.path === path) !== -1;
                if (!hasDevice) {
                    const removedItem = this.itemList.get(path);
                    if (removedItem){
                        removedItems.push(removedItem);
                        this.itemList.delete(path);
                    }
                }
            }
        }
        return {addedItems, removedItems};
    };

    /**
     * Refresh Controller list.
     * @param types Types to keep in refreshed list.
     * @return
     */
    private async refreshItemList(...types: DeviceType[]) {
        const allDevices = this.filterDevices();
        let addedItems = new Array<DeviceInfo>();
        let removedItems = new Array<DeviceInfo>();
        let listChanged = false;


        for (const type of types) {
            let devices: HidDevice[] | null = null;
            switch (type) {
                case "steam-dongle":
                    devices = this.filterDevices({
                        devices: allDevices,
                        filter: (device) => {
                            return device.productId === SteamHidId.DongleProduct &&
                                device.vendorId === SteamHidId.Vendor &&
                                device.interface > 0 && device.interface < 5;
                        },
                        sort: (a, b) => {
                            return a.interface > b.interface ? 1 : 0;
                        },
                    });
                    break;
                case "steam-wired":
                    devices = this.filterDevices({
                        devices: allDevices,
                        filter: (device) => {
                            return device.productId === SteamHidId.WiredProduct &&
                                device.vendorId === SteamHidId.Vendor &&
                                device.interface > 0 && device.interface < 5;
                        },
                        sort: (a, b) => {
                            return a.interface > b.interface ? 1 : 0;
                        },
                    });
                    break;
            }
            if (devices !== null) {
                const changedItems = this.setDevices(devices, type);
                if (type === "steam-dongle") {
                   await this.updateSteamDongleStatus();
                }
                addedItems.concat(changedItems.addedItems)
                removedItems.concat(changedItems.removedItems)

                listChanged = true;
            }
        }
        return {listChanged, addedItems, removedItems};
    }

    private async updateSteamDongleStatus() {
        const wirelessStateCheck = new HidFeatureArray(0xB4).array;

        for (const [path, item] of this.itemList) {
            try {
                if (item.type === "steam-dongle") {
                    const device = new HID(path);
                    device!.sendFeatureReport(wirelessStateCheck);

                    const data = device!.getFeatureReport(wirelessStateCheck[0], wirelessStateCheck.length);
                    item.active = data![2] > 0 && data![3] === 2;
                }
                // tslint:disable-next-line:no-empty
            } catch (everything) { 
                debug("HID Device disconnected while updating Steam Dongle status")
            } // In case HID devices are disconnected
        }
    }



}