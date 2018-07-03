import { Device as HidDevice } from "node-hid";

export interface SteamHidDeviceItem {
    info: HidDevice;
    type: "wirelessConnected" | "wirelessDisconnected" | "wired";
    inUse: boolean;
}
