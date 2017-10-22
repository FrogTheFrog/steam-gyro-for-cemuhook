import { EventListener } from "./event-listener";
import * as long from "long";

export namespace DualShock {
    export type InterfaceEvents = 'removed' | 'DS_Report' | 'error';

    export enum State {
        Disconnected = 0x00,
        Reserved = 0x01,
        Connected = 0x02
    }

    export enum Connection {
        None = 0x00,
        Usb = 0x01,
        Bluetooth = 0x02
    }

    export enum Model {
        None = 0,
        DS3 = 1,
        DS4 = 2,
        Generic = 3
    }

    export enum Battery {
        None = 0x00,
        Dying = 0x01,
        Low = 0x02,
        Medium = 0x03,
        High = 0x04,
        Full = 0x05,
        Charging = 0xEE,
        Charged = 0xEF
    }

    export interface PadMeta {
        padId: number,
        state: State,
        connectionType: Connection,
        model: Model,
        macAddress: string,
        batteryStatus: Battery,
        isActive: boolean
    }

    export interface Report {
        packetCounter: number,
        motionTimestamp: long,
        button: {
            R1: boolean,
            L1: boolean,
            R2: boolean,
            L2: boolean,
            R3: boolean,
            L3: boolean,
            PS: boolean,
            SQUARE: boolean,
            CROSS: boolean,
            CIRCLE: boolean,
            TRIANGLE: boolean,
            options: boolean,
            share: boolean,
            dPad: {
                UP: boolean,
                RIGHT: boolean,
                LEFT: boolean,
                DOWN: boolean
            },
            touch: boolean
        },
        position: {
            left: { x: number, y: number },
            right: { x: number, y: number }
        },
        trigger: {
            L2: number,
            R2: number
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
        trackPad: {
            first: {
                isActive: boolean,
                id: number,
                x: number,
                y: number
            },
            second: {
                isActive: boolean,
                id: number,
                x: number,
                y: number
            }
        }
    }

    export abstract class Interface extends EventListener {
        abstract connect(): boolean;
        abstract disconnect();
        abstract isValid(): boolean;
        abstract getDualShockMeta(id: number): PadMeta;
        abstract getDualShockReport(id: number): Report;

        addEventListener(event: InterfaceEvents, callback: (...data: any[]) => void) {
            super.addEventListener(event, callback);
        }

        removeEventListener(event: InterfaceEvents, callback: (...data: any[]) => void) {
            super.removeEventListener(event, callback);
        }

        hasListeners(event: InterfaceEvents) {
            return super.hasListeners(event);
        }
    }
}