import { crc32 } from "crc";
import * as dgram from "dgram";
import { AddressInfo } from "net";
import { MersenneTwister19937, Random } from "random-js";
import { BehaviorSubject, Subject, Subscription } from "rxjs";
import { privateData } from "../../../shared/lib";
import {
    UdpServerDefaults,
    UdpServerMessage,
} from "../../models";
import { ClientRequestTimes } from "./client-request-times";

import { 
    ControllerMaster,
    DualshockData,
    DualshockMeta,
    GenericController,
    MotionData,
    MotionDataWithTimestamp
} from "../../../controller-api"
import { MatButtonToggleGroupMultiple } from "@angular/material";


/**
 * Internal class data interface.
 */
interface InternalData {
    connectionStatus: BehaviorSubject<boolean>;
    errorSubject: Subject<Error>;
    onMessageTimeout: NodeJS.Timer | null;
}

/**
 * Private data getter.
 */
const getInternals = privateData() as (self: UdpServer, init: InternalData | void) => InternalData;

/**
 * Shorthand function for getting character code from character.
 * @param character Character value to get code for.
 * @returns Character code for provided value.
 */
function charCode(character: string) {
    return character.charCodeAt(0);
}

/**
 * UDP server class for handling communication over cemuhook UDP protocol.
 */
export class UdpServer {
    /**
     * Currently open socket.
     */
    private socket: dgram.Socket | null = null;

    /**
     * Server ID to send to cemuhook.
     */
    private serverId: number = new Random(MersenneTwister19937.autoSeed()).uint32();

    private controllerMaster : ControllerMaster;
    
    /**
     * Connected Dualshock controllers.
     */
    private controllers: Array<{
        device: GenericController<MotionDataWithTimestamp>,
        subscription: Subscription,
    } | null> = new Array(4).fill(null);

    /**
     * Connected clients.
     */
    private clients = new Map<AddressInfo, ClientRequestTimes>();

    constructor(controllerMaster: ControllerMaster) {
        this.controllerMaster = controllerMaster;
        getInternals(this, {
            connectionStatus: new BehaviorSubject<boolean>(false),
            errorSubject: new Subject(),
            onMessageTimeout: null,
        });
    }

    /**
     * Event observable.
     */
    public get onError() {
        return getInternals(this).errorSubject.asObservable();
    }

    /**
     * Status change observable.
     */
    public get onStatusChange() {
        return getInternals(this).connectionStatus.asObservable();
    }

    /**
     * Start UDP server.
     * @param port Custom port.
     * @param address Custom address.
     */
    public async start(port?: number, address?: string) {
        const pd = getInternals(this);

        return new Promise<void>(async (resolve, reject) => {
            try {
                await this.stop();
                this.socket = dgram.createSocket("udp4");

                this.socket.once("error", reject);
                this.socket.once("listening", () => {
                    this.socket!.removeListener("error", reject);

                    this.socket!.on("error", pd.errorSubject.next.bind(pd.errorSubject));
                    this.socket!.on("message", this.onMessage.bind(this));

                    resolve();
                });

                this.socket.bind(port, address);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Stop UDP server.
     */
    public async stop() {
        return new Promise<void>(async (resolve, reject) => {
            try {
                if (this.socket !== null) {
                    this.socket.removeAllListeners("error");
                    this.socket.removeAllListeners("message");

                    this.socket.once("error", reject);

                    this.socket.close();
                    this.socket = null;
                }
                resolve();
            } catch (error) {
                reject(error);
            }
        });

    }

    /**
     * Adds controller to server slot.
     * @param controller Controller to add.
     * @returns `false` if there are no more spots for controller.
     */
    public addController(controller: GenericController<MotionDataWithTimestamp>) {
        const pd = getInternals(this);

        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < this.controllers.length; i++) {
            if (this.controllers[i] === null) {
                this.controllers[i] = {
                    device: controller,
                    subscription: new Subscription(),
                };

                this.controllers[i]!.subscription
                    .add(controller.onError.subscribe((value) => pd.errorSubject.next(value)))
                    .add(controller.onDualshockData.subscribe((value) => this.handleReport(value)));

                return true;
            }
        }

        return false;
    }

    /**
     * Remove all controllers or only specified controller.
     * @param index Index of the controller to remove.
     */
    public removeController(controller?: GenericController<MotionDataWithTimestamp> | null) {
        if (!(controller instanceof GenericController)) {
            for (let i = 0; i < this.controllers.length; i++) {
                this.removeController(this.controllers[i]!.device!);
            }
        } else {
            this.controllers = this.controllers.filter(value => value === null || value!.device.path != controller.path);
        }
    }

    /**
     * Clear client list.
     */
    public clearClients() {
        this.clients.clear();
        this.changeConnectionStatus(false);
    }

    /**
     * Begins data packet.
     * @param data Data to add to packet's start.
     * @param protocolVer Protocol version.
     */
    private beginPacket(data: Buffer, protocolVer: number = UdpServerDefaults.MaxProtocolVer) {
        if (data.length >= 16) {
            let index = 0;
            data[index++] = charCode("D");
            data[index++] = charCode("S");
            data[index++] = charCode("U");
            data[index++] = charCode("S");

            data.writeUInt16LE(protocolVer, index);
            index += 2;

            data.writeUInt16LE(data.length - 16, index);
            index += 2;

            data.writeUInt32LE(0, index);
            index += 4;

            data.writeUInt32LE(this.serverId, index);
            index += 4;

            return index;
        } else {
            throw new Error(`"beginPacket" buffer size is too small (${data.length})`);
        }
    }

    /**
     * Finish packet by adding crc32 validation.
     * @param data Data to generate crc32 with.
     */
    private finishPacket(data: Buffer) {
        data.writeUInt32LE(crc32(data), 8);
    }

    /**
     * Send packet to client.
     * @param clientEndpoint Client endpoint data.
     * @param data Data to send.
     * @param protocolVer Protocol version to use.
     */
    private sendPacket(
        clientEndpoint: AddressInfo,
        data: Buffer,
        protocolVer: number = UdpServerDefaults.MaxProtocolVer,
    ) {
        const buffer = Buffer.alloc(data.length + 16);
        const index = this.beginPacket(buffer, protocolVer);
        buffer.fill(data, index);
        this.finishPacket(buffer);

        this.socket!.send(buffer, clientEndpoint.port, clientEndpoint.address, (error, bytes) => {
            const pd = getInternals(this);
            if (error) {
                pd.errorSubject.next(error);
            } else if (bytes !== buffer.length) {
                // tslint:disable-next-line:max-line-length
                pd.errorSubject.next(new Error(`failed to completely send all of buffer. Sent: ${bytes}. Buffer length: ${buffer.length}`));
            }
        });
    }

    /**
     * Data from clients handler.
     * @param data Data received from client.
     * @param clientEndpoint Client endpoint data.
     */
    private onMessage(data: Buffer, clientEndpoint: AddressInfo) {
        try {
            if (data[0] === charCode("D") &&
                data[1] === charCode("S") &&
                data[2] === charCode("U") &&
                data[3] === charCode("C")
            ) {
                this.refreshStatus();
                
                let index = 4;

                const protocolVer = data.readUInt16LE(index);

                if (protocolVer > UdpServerDefaults.MaxProtocolVer) {
                    // tslint:disable-next-line:max-line-length
                    throw new Error(`outdated protocol. Received: ${protocolVer}. Current: ${UdpServerDefaults.MaxProtocolVer}.`);
                } else {
                    index += 2;
                }

                const packetSize = data.readUInt16LE(index);

                if (packetSize < 0) {
                    throw new Error(`negative packet size received (${packetSize}).`);
                } else {
                    index += 2;
                }

                const receivedCrc = data.readUInt32LE(index);
                data[index++] = 0;
                data[index++] = 0;
                data[index++] = 0;
                data[index++] = 0;

                const computedCrc = crc32(data);

                if (receivedCrc !== computedCrc) {
                    throw new Error(`crc mismatch. Received: ${receivedCrc}. Computed: ${computedCrc}.`);
                }

                const clientId = data.readUInt32LE(index);
                index += 4;

                const msgType = data.readUInt32LE(index);
                index += 4;

                if (msgType === UdpServerMessage.DSUC_VersionReq) {
                    const outBuffer = Buffer.alloc(8);

                    outBuffer.writeUInt32LE(UdpServerMessage.DSUS_VersionRsp, 0);
                    outBuffer.writeUInt32LE(UdpServerDefaults.MaxProtocolVer, 4);
                    this.sendPacket(clientEndpoint, outBuffer, 1001);
                } else if (msgType === UdpServerMessage.DSUC_ListPorts) {
                    const numOfPadRequests = data.readInt32LE(index);

                    if (numOfPadRequests < 0 || numOfPadRequests > 4) {
                        // tslint:disable-next-line:max-line-length
                        throw new Error(`number of pad requests is out of range. Range: [0; 4]. Request: ${numOfPadRequests}.`);
                    }
                    else {
                        index += 4;
                    }

                    for (let i = 0; i < numOfPadRequests; i++) {
                        if (data[index + i] > 3) {
                            // tslint:disable-next-line:max-line-length
                            throw new Error(`request index for ${i} pad is out of range. Range: [0; 3]. Request: ${data[index + i]}.`);
                        }
                    }

                    const outBuffer = Buffer.alloc(16);
                    for (let i = 0; i < numOfPadRequests; i++) {
                        const requestIndex = data[index + i];
                        const controller = this.controllers[requestIndex];

                        const meta = controller ? controller.device.dualShockMeta : null;
                        if (meta !== null) {
                            outBuffer.writeUInt32LE(UdpServerMessage.DSUS_PortInfo, 0);
                            let outIndex = 4;

                            outBuffer[outIndex++] = meta.padId;
                            outBuffer[outIndex++] = meta.state;
                            outBuffer[outIndex++] = meta.model;
                            outBuffer[outIndex++] = meta.connectionType;

                            if (meta.macAddress !== null && meta.macAddress.length === 17) {
                                const mac = meta.macAddress.split(":").map((part) => parseInt(part, 16));
                                for (const macPart of mac) {
                                    outBuffer[outIndex++] = macPart;
                                }
                            } else {
                                for (let j = 0; j < 6; j++) {
                                    outBuffer[outIndex++] = 0;
                                }
                            }

                            outBuffer[outIndex++] = meta.batteryStatus;
                            outBuffer[outIndex++] = 0;

                            this.sendPacket(clientEndpoint, outBuffer, 1001);
                        }
                    }
                } else if (msgType === UdpServerMessage.DSUC_PadDataReq) {
                    const registrationFlags = data[index++];
                    const idToRRegister = data[index++];
                    let macToRegister: string | string[] = ["", "", "", "", "", ""];

                    for (let i = 0; i < macToRegister.length; i++ , index++) {
                        macToRegister[i] = `${data[index] < 15 ? "0" : ""}${data[index].toString(16)}`;
                    }

                    macToRegister = macToRegister.join(":");

                    if (!this.clients.has(clientEndpoint)) {
                        this.clients.set(clientEndpoint, new ClientRequestTimes());
                    }

                    this.clients
                        .get(clientEndpoint)!.registerPadRequest(registrationFlags, idToRRegister, macToRegister);
                }
            }
        } catch (error) {
            getInternals(this).errorSubject.next(error);
        }
    }

    /**
     * Handle reports emitted by controller.
     * @param data Event data to handle.
     */
    private handleReport(data: DualshockData) {
        try {
            if (this.socket !== null) {
                const meta = data.meta;
                const clients = this.getClientsForReport(meta);

                if (clients.length > 0) {
                    const report = data.report;
                    const outBuffer = Buffer.alloc(100);
                    let outIndex = this.beginPacket(outBuffer, 1001);
                    outBuffer.writeUInt32LE(UdpServerMessage.DSUS_PadDataRsp, outIndex);
                    outIndex += 4;

                    outBuffer[outIndex++] = meta.padId;
                    outBuffer[outIndex++] = meta.state;
                    outBuffer[outIndex++] = meta.model;
                    outBuffer[outIndex++] = meta.connectionType;

                    const mac = meta.macAddress.split(":").map((part) => parseInt(part, 16));
                    for (const macPart of mac) {
                        outBuffer[outIndex++] = macPart;
                    }

                    outBuffer[outIndex++] = meta.batteryStatus;
                    outBuffer[outIndex++] = meta.isActive ? 0x01 : 0x00;

                    outBuffer.writeUInt32LE(report.packetCounter, outIndex);
                    outIndex += 4;

                    outBuffer[outIndex] = 0;

                    if (report.button.dPad.LEFT) { outBuffer[outIndex] |= 0x80; }
                    if (report.button.dPad.DOWN) { outBuffer[outIndex] |= 0x40; }
                    if (report.button.dPad.RIGHT) { outBuffer[outIndex] |= 0x20; }
                    if (report.button.dPad.UP) { outBuffer[outIndex] |= 0x10; }

                    if (report.button.options) { outBuffer[outIndex] |= 0x08; }
                    if (report.button.R3) { outBuffer[outIndex] |= 0x04; }
                    if (report.button.L3) { outBuffer[outIndex] |= 0x02; }
                    if (report.button.share) { outBuffer[outIndex] |= 0x01; }

                    outBuffer[++outIndex] = 0;

                    if (report.button.SQUARE) { outBuffer[outIndex] |= 0x80; }
                    if (report.button.CROSS) { outBuffer[outIndex] |= 0x40; }
                    if (report.button.CIRCLE) { outBuffer[outIndex] |= 0x20; }
                    if (report.button.TRIANGLE) { outBuffer[outIndex] |= 0x10; }

                    if (report.button.R1) { outBuffer[outIndex] |= 0x08; }
                    if (report.button.L1) { outBuffer[outIndex] |= 0x04; }
                    if (report.button.R2) { outBuffer[outIndex] |= 0x02; }
                    if (report.button.L2) { outBuffer[outIndex] |= 0x01; }

                    outBuffer[++outIndex] = (report.button.PS) ? 0x01 : 0x00;
                    outBuffer[++outIndex] = (report.button.touch) ? 0x01 : 0x00;

                    outBuffer[++outIndex] = report.position.left.x;
                    outBuffer[++outIndex] = report.position.left.y;

                    outBuffer[++outIndex] = report.position.right.x;
                    outBuffer[++outIndex] = report.position.right.y;

                    outBuffer[++outIndex] = report.button.dPad.LEFT ? 0xFF : 0x00;
                    outBuffer[++outIndex] = report.button.dPad.DOWN ? 0xFF : 0x00;
                    outBuffer[++outIndex] = report.button.dPad.RIGHT ? 0xFF : 0x00;
                    outBuffer[++outIndex] = report.button.dPad.UP ? 0xFF : 0x00;

                    outBuffer[++outIndex] = report.button.SQUARE ? 0xFF : 0x00;
                    outBuffer[++outIndex] = report.button.CROSS ? 0xFF : 0x00;
                    outBuffer[++outIndex] = report.button.CIRCLE ? 0xFF : 0x00;
                    outBuffer[++outIndex] = report.button.TRIANGLE ? 0xFF : 0x00;

                    outBuffer[++outIndex] = report.button.R1 ? 0xFF : 0x00;
                    outBuffer[++outIndex] = report.button.L1 ? 0xFF : 0x00;

                    outBuffer[++outIndex] = report.trigger.R2;
                    outBuffer[++outIndex] = report.trigger.L2;

                    outIndex++;

                    outBuffer[outIndex++] = report.trackPad.first.isActive ? 0x01 : 0x00;
                    outBuffer[outIndex++] = report.trackPad.first.id;
                    outBuffer.writeUInt16LE(report.trackPad.first.x, outIndex);
                    outIndex += 2;
                    outBuffer.writeUInt16LE(report.trackPad.first.y, outIndex);
                    outIndex += 2;

                    outBuffer[outIndex++] = report.trackPad.second.isActive ? 0x01 : 0x00;
                    outBuffer[outIndex++] = report.trackPad.second.id;
                    outBuffer.writeUInt16LE(report.trackPad.second.x, outIndex);
                    outIndex += 2;
                    outBuffer.writeUInt16LE(report.trackPad.second.y, outIndex);
                    outIndex += 2;

                    outBuffer.writeUInt32LE(report.motionTimestamp.getLowBitsUnsigned(), outIndex);
                    outIndex += 4;
                    outBuffer.writeUInt32LE(report.motionTimestamp.getHighBitsUnsigned(), outIndex);
                    outIndex += 4;

                    outBuffer.writeFloatLE(report.accelerometer.x, outIndex);
                    outIndex += 4;
                    outBuffer.writeFloatLE(report.accelerometer.y, outIndex);
                    outIndex += 4;
                    outBuffer.writeFloatLE(report.accelerometer.z, outIndex);
                    outIndex += 4;

                    outBuffer.writeFloatLE(report.gyro.x, outIndex);
                    outIndex += 4;
                    outBuffer.writeFloatLE(report.gyro.y, outIndex);
                    outIndex += 4;
                    outBuffer.writeFloatLE(report.gyro.z, outIndex);
                    outIndex += 4;

                    this.finishPacket(outBuffer);

                    for (const client of clients) {
                        this.socket.send(outBuffer, client.port, client.address, (error, bytes) => {
                            const pd = getInternals(this);
                            if (error) {
                                pd.errorSubject.next(error);
                            } else if (bytes !== outBuffer.length) {
                                // tslint:disable-next-line:max-line-length
                                pd.errorSubject.next(new Error(`failed to completely send all of buffer. Sent: ${bytes}. Buffer length: ${outBuffer.length}`));
                            }
                        });
                    }
                }
            }
        } catch (error) {
            const stringifiedData = JSON.stringify(data, undefined, "    ");
            if (error instanceof Error) {
                error.message += ` (\n${stringifiedData}\n).`;
            } else {
                error += ` (\n${stringifiedData}\n).`;
            }
            getInternals(this).errorSubject.next(error);
        }
    }

    /**
     * Status timeout used to detect lost UDP connection.
     */
    private refreshStatus(){
        const internals = getInternals(this);

        if (internals.onMessageTimeout !== null){
            clearTimeout(internals.onMessageTimeout);
            internals.onMessageTimeout = null;
        }

        this.changeConnectionStatus(true);
        internals.onMessageTimeout = setTimeout(() => {
            this.changeConnectionStatus(false);
            internals.onMessageTimeout = null;
        }, 1000);
    }

    /**
     * Change status indicating whether a connection to UDP server is established.
     * @param status New connection status.
     */
    private changeConnectionStatus(status: boolean){
        const internals = getInternals(this);
        if (status !== internals.connectionStatus.value)
        {
            internals.connectionStatus.next(status);
        }
    }

    /**
     * Retrieve active clients associated with provided metadata.
     * @param meta Metadata to search for clients by.
     * @returns Array of client endpoint data.
     */
    private getClientsForReport(meta: DualshockMeta) {
        const clients: AddressInfo[] = [];
        const clientsToDelete: AddressInfo[] = [];
        const currentTime = Date.now();

        for (const [info, times] of this.clients) {
            if (currentTime - times.timeForAllPads < UdpServerDefaults.ClientTimeoutLimit) {
                clients.push(info);
            } else if (
                (meta.padId < times.timeForPadById.length) &&
                (currentTime - times.timeForPadById[meta.padId] < UdpServerDefaults.ClientTimeoutLimit)
            ) {
                clients.push(info);
            } else if (
                times.timeForPadByMac.has(meta.macAddress) &&
                (currentTime - times.timeForPadByMac.get(meta.macAddress)! < UdpServerDefaults.ClientTimeoutLimit)
            ) {
                clients.push(info);
            } else {
                let isClientOk = false;
                for (const time of times.timeForPadById) {
                    if (currentTime - time < UdpServerDefaults.ClientTimeoutLimit) {
                        isClientOk = true;
                        break;
                    }
                }
                if (!isClientOk) {
                    for (const [mac, time] of times.timeForPadByMac) {
                        if (currentTime - time < UdpServerDefaults.ClientTimeoutLimit) {
                            isClientOk = true;
                            break;
                        }
                    }

                    if (!isClientOk) {
                        clientsToDelete.push(info);
                    }
                }
            }
        }

        for (const client of clientsToDelete) {
            this.clients.delete(client);
        }

        return clients;
    }
}
