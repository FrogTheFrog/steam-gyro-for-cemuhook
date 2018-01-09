import { DualShock } from "./dualshock";
import { TypedEventEmitter } from "./typed-event-emitter";
import * as dgram from "dgram";
import * as crc from "crc";
import * as randomJS from "random-js";
import * as _ from "lodash";

function char(a: string) {
    return a.charCodeAt(0);
}

class ClientRequestTimes {
    public timeForAllPads: number;
    public timeForPadById: number[];
    public timeForPadByMac: Map<string, number>;

    constructor() {
        this.timeForAllPads = 0;
        this.timeForPadById = [0, 0, 0, 0];
        this.timeForPadByMac = new Map<string, number>();
    }

    registerPadRequest(regFlags: number, idToReg: number, macToReg: string) {
        let currentData = Date.now();

        if (regFlags === 0)
            this.timeForAllPads = currentData;
        else {
            if ((regFlags & 0x01) !== 0) {
                if (idToReg < this.timeForPadById.length)
                    this.timeForPadById[idToReg] = currentData;
            }
            if ((regFlags & 0x02) !== 0) {
                this.timeForPadByMac.set(macToReg, currentData);
            }
        }
    }
}

export namespace UdpServer {
    export const maxProtocolVer: number = 1001;
    export const clientTimeoutLimit: number = 5000;

    export interface Events {
        error: { error: Error }
    }

    export const enum MessageType {
        DSUC_VersionReq = 0x100000,
        DSUS_VersionRsp = 0x100000,
        DSUC_ListPorts = 0x100001,
        DSUS_PortInfo = 0x100001,
        DSUC_PadDataReq = 0x100002,
        DSUS_PadDataRsp = 0x100002
    }

    export class UdpServer extends TypedEventEmitter<Events> {
        private socket: dgram.Socket = undefined;
        private serverId: number = randomJS().integer(0, 9007199254740992);
        private controllers: DualShock.DualShockGenericController[] = new Array(4).fill(undefined);
        private clients = new Map<dgram.AddressInfo, ClientRequestTimes>();

        start(port?: number, address?: string, callback?: () => void) {
            this.stop();
            this.socket = dgram.createSocket('udp4');

            this.socket.on('error', this.errorCallback.bind(this));
            this.socket.on('message', this.onMessage.bind(this));

            this.socket.bind(port, address, callback);
        }

        addController(controller: DualShock.DualShockGenericController, autoOpen: boolean = false) {
            for (let i = 0; i < this.controllers.length; i++) {
                if (this.controllers[i] === undefined) {
                    this.controllers[i] = controller;
                    this.controllers[i].on('error', this.errorCallback);
                    this.controllers[i].on('DS_Report', this.handleReport);

                    if (autoOpen)
                        this.controllers[i].close

                    return true;
                }
            }

            return false;
        }

        removeController(index?: number, autoClose: boolean = false) {
            if (index !== undefined) {
                for (let i = 0; i < this.controllers.length; i++) {
                    if (this.controllers[i] !== undefined) {
                        if (autoClose)
                            this.controllers[i].close();

                        this.controllers[i].removeListener('error', this.errorCallback);
                        this.controllers[i].removeListener('DS_Report', this.handleReport);
                        this.controllers[i] = undefined;
                    }
                }
            }
            else if (index > 0 && index < this.controllers.length) {
                if (this.controllers[index] !== undefined) {
                    if (autoClose)
                        this.controllers[index].close();

                    this.controllers[index].removeListener('error', this.errorCallback);
                    this.controllers[index].removeListener('DS_Report', this.handleReport);
                    this.controllers[index] = undefined;
                }
            }
        }

        stop() {
            if (this.socket !== undefined) {
                this.socket.close();
                this.socket = undefined;
            }
        }

        clearClients() {
            this.clients.clear();
        }

        private beginPacket(data: Buffer, protocolVer: number = maxProtocolVer) {
            if (data.length >= 16) {
                let index = 0;
                data[index++] = char('D');
                data[index++] = char('S');
                data[index++] = char('U');
                data[index++] = char('S');

                data.writeUInt16LE(protocolVer, index, true);
                index += 2;

                data.writeUInt16LE(data.length - 16, index, true);
                index += 2;

                data.writeUInt32LE(0, index, true);
                index += 4;

                data.writeUInt32LE(this.serverId, index, true);
                index += 4;

                return index;
            }
            else
                throw new Error(`"beginPacket" buffer size is too small (${data.length})`);
        }

        private finishPacket(data: Buffer) {
            data.writeUInt32LE(crc.crc32(data), 8, true);
        }

        private sendPacket(clientEndpoint: dgram.AddressInfo, data: Buffer, protocolVer: number = maxProtocolVer, callback?: () => void) {
            let buffer = Buffer.alloc(data.length + 16);
            let index = this.beginPacket(buffer, protocolVer);
            buffer.fill(data, index);
            this.finishPacket(buffer);

            this.socket.send(buffer, clientEndpoint.port, clientEndpoint.address, (error, bytes) => {
                if (error) {
                    this.errorCallback(error);
                }
                else if (bytes !== buffer.length) {
                    this.errorCallback(new Error(`failed to completely send all of buffer. Sent: ${bytes}. Buffer length: ${buffer.length}`));
                }
                else if (callback !== undefined) {
                    callback();
                }
            });
        }

        private onMessage(data: Buffer, clientEndpoint: dgram.AddressInfo) {
            try {
                if (data[0] === char('D') && data[1] === char('S') && data[2] === char('U') && data[3] === char('C')) {
                    let index = 4;
                    let protocolVer = data.readUInt16LE(index);

                    if (protocolVer > maxProtocolVer)
                        throw new Error(`outdated protocol. Received: ${protocolVer}. Current: ${maxProtocolVer}.`);
                    else
                        index += 2;

                    let packetSize = data.readUInt16LE(index);

                    if (packetSize < 0)
                        throw new Error(`negative packet size received (${packetSize}).`);
                    else
                        index += 2;

                    let receivedCrc = data.readUInt32LE(index);
                    data[index++] = 0;
                    data[index++] = 0;
                    data[index++] = 0;
                    data[index++] = 0;

                    let computedCrc = crc.crc32(data);

                    if (receivedCrc !== computedCrc)
                        throw new Error(`crc mismatch. Received: ${receivedCrc}. Computed: ${computedCrc}.`);

                    let clientId = data.readUInt32LE(index);
                    index += 4;

                    let msgType = data.readUInt32LE(index);
                    index += 4;

                    if (msgType === MessageType.DSUC_VersionReq) {
                        let outBuffer = Buffer.alloc(8);
                        outBuffer.writeUInt32LE(MessageType.DSUS_VersionRsp, 0, true);
                        outBuffer.writeUInt32LE(maxProtocolVer, 4, true);
                        this.sendPacket(clientEndpoint, outBuffer, 1001);
                    }
                    else if (msgType === MessageType.DSUC_ListPorts) {
                        let numOfPadRequests = data.readInt32LE(index);

                        if (numOfPadRequests < 0 || numOfPadRequests > 4)
                            throw new Error(`number of pad requests is out of range. Range: [0; 4]. Request: ${numOfPadRequests}.`);
                        else
                            index += 4;

                        for (let i = 0; i < numOfPadRequests; i++) {
                            if (data[index + i] > 3)
                                throw new Error(`request index for ${i} pad is out of range. Range: [0; 3]. Request: ${data[index + i]}.`);
                        }

                        let outBuffer = Buffer.alloc(16);
                        for (let i = 0; i < numOfPadRequests; i++) {
                            let requestIndex = data[index + i];

                            let meta = this.controllers[requestIndex] !== undefined ? this.controllers[requestIndex].getDualShockMeta() : undefined;
                            if (meta !== undefined) {
                                outBuffer.writeUInt32LE(MessageType.DSUS_PortInfo, 0, true);
                                let outIndex = 4;

                                outBuffer[outIndex++] = meta.padId;
                                outBuffer[outIndex++] = meta.state;
                                outBuffer[outIndex++] = meta.model;
                                outBuffer[outIndex++] = meta.connectionType;

                                if (meta.macAddress !== null && meta.macAddress.length === 17) {
                                    let mac = meta.macAddress.split(':').map((part) => parseInt(part, 16));
                                    for (let j = 0; j < mac.length; j++) {
                                        outBuffer[outIndex++] = mac[j];
                                    }
                                }
                                else {
                                    for (let j = 0; j < 6; j++) {
                                        outBuffer[outIndex++] = 0;
                                    }
                                }

                                outBuffer[outIndex++] = meta.batteryStatus;
                                outBuffer[outIndex++] = 0;

                                this.sendPacket(clientEndpoint, outBuffer, 1001);
                            }
                        }
                    }
                    else if (msgType === MessageType.DSUC_PadDataReq) {
                        let registrationFlags = data[index++];
                        let idToRRegister = data[index++];
                        let macToRegister: string | string[] = ['', '', '', '', '', ''];

                        for (let i = 0; i < macToRegister.length; i++ , index++) {
                            macToRegister[i] = `${data[index] < 15 ? '0' : ''}${data[index].toString(16)}`;
                        }

                        macToRegister = macToRegister.join(':');

                        if (!this.clients.has(clientEndpoint))
                            this.clients.set(clientEndpoint, new ClientRequestTimes());

                        this.clients.get(clientEndpoint).registerPadRequest(registrationFlags, idToRRegister, macToRegister);
                    }
                }
            }
            catch (error) {
                this.errorCallback(error);
            }
        }

        private errorCallback = (error: Error) => {
            this.emit('error', { error });
        }

        private handleReport = (data: { report: DualShock.Report, meta: DualShock.Meta }) => {
            try {
                if (this.socket !== undefined) {
                    let meta = data.meta;
                    let clients = this.getClientsForReport(meta);

                    if (clients.length > 0) {
                        let report = data.report;
                        let outBuffer = Buffer.alloc(100);
                        let outIndex = this.beginPacket(outBuffer, 1001);
                        outBuffer.writeUInt32LE(MessageType.DSUS_PadDataRsp, outIndex, true);
                        outIndex += 4;

                        outBuffer[outIndex++] = meta.padId;
                        outBuffer[outIndex++] = meta.state;
                        outBuffer[outIndex++] = meta.model;
                        outBuffer[outIndex++] = meta.connectionType;

                        let mac = meta.macAddress.split(':').map((part) => parseInt(part, 16));
                        for (let i = 0; i < mac.length; i++) {
                            outBuffer[outIndex++] = mac[i];
                        }

                        outBuffer[outIndex++] = meta.batteryStatus;
                        outBuffer[outIndex++] = meta.isActive ? 0x01 : 0x00;

                        outBuffer.writeUInt32LE(report.packetCounter, outIndex, true);
                        outIndex += 4;

                        outBuffer[outIndex] = 0;

                        if (report.button.dPad.LEFT) outBuffer[outIndex] |= 0x80;
                        if (report.button.dPad.DOWN) outBuffer[outIndex] |= 0x40;
                        if (report.button.dPad.RIGHT) outBuffer[outIndex] |= 0x20;
                        if (report.button.dPad.UP) outBuffer[outIndex] |= 0x10;

                        if (report.button.options) outBuffer[outIndex] |= 0x08;
                        if (report.button.R3) outBuffer[outIndex] |= 0x04;
                        if (report.button.L3) outBuffer[outIndex] |= 0x02;
                        if (report.button.share) outBuffer[outIndex] |= 0x01;

                        outBuffer[++outIndex] = 0;

                        if (report.button.SQUARE) outBuffer[outIndex] |= 0x80;
                        if (report.button.CROSS) outBuffer[outIndex] |= 0x40;
                        if (report.button.CIRCLE) outBuffer[outIndex] |= 0x20;
                        if (report.button.TRIANGLE) outBuffer[outIndex] |= 0x10;

                        if (report.button.R1) outBuffer[outIndex] |= 0x08;
                        if (report.button.L1) outBuffer[outIndex] |= 0x04;
                        if (report.button.R2) outBuffer[outIndex] |= 0x02;
                        if (report.button.L2) outBuffer[outIndex] |= 0x01;

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
                        outBuffer.writeUInt16LE(report.trackPad.first.x, outIndex, true);
                        outIndex += 2;
                        outBuffer.writeUInt16LE(report.trackPad.first.y, outIndex, true);
                        outIndex += 2;

                        outBuffer[outIndex++] = report.trackPad.second.isActive ? 0x01 : 0x00;
                        outBuffer[outIndex++] = report.trackPad.second.id;
                        outBuffer.writeUInt16LE(report.trackPad.second.x, outIndex, true);
                        outIndex += 2;
                        outBuffer.writeUInt16LE(report.trackPad.second.y, outIndex, true);
                        outIndex += 2;

                        outBuffer.writeUInt32LE(report.motionTimestamp.low, outIndex, true);
                        outIndex += 4;
                        outBuffer.writeUInt32LE(report.motionTimestamp.high, outIndex, true);
                        outIndex += 4;

                        outBuffer.writeFloatLE(report.accelerometer.x, outIndex, true);
                        outIndex += 4;
                        outBuffer.writeFloatLE(report.accelerometer.y, outIndex, true);
                        outIndex += 4;
                        outBuffer.writeFloatLE(report.accelerometer.z, outIndex, true);
                        outIndex += 4;

                        outBuffer.writeFloatLE(report.gyro.x, outIndex, true);
                        outIndex += 4;
                        outBuffer.writeFloatLE(report.gyro.y, outIndex, true);
                        outIndex += 4;
                        outBuffer.writeFloatLE(report.gyro.z, outIndex, true);
                        outIndex += 4;

                        this.finishPacket(outBuffer);

                        for (let i = 0; i < clients.length; i++) {
                            this.socket.send(outBuffer, clients[i].port, clients[i].address, (error, bytes) => {
                                if (error) {
                                    this.errorCallback(error);
                                }
                                else if (bytes !== outBuffer.length) {
                                    this.errorCallback(new Error(`failed to completely send all of buffer. Sent: ${bytes}. Buffer length: ${outBuffer.length}`));
                                }
                            });
                        }
                    }
                }
            }
            catch (error) {
                this.errorCallback(error);
            }
        }

        private getClientsForReport(meta: DualShock.Meta) {
            let clients: dgram.AddressInfo[] = [];
            let clientsToDelete: dgram.AddressInfo[] = [];
            let currentTime = Date.now();

            for (let [info, times] of this.clients) {
                if (currentTime - times.timeForAllPads < clientTimeoutLimit)
                    clients.push(info);
                else if ((meta.padId < times.timeForPadById.length) && (currentTime - times.timeForPadById[meta.padId] < clientTimeoutLimit))
                    clients.push(info);
                else if (times.timeForPadByMac.has(meta.macAddress) && (currentTime - times.timeForPadByMac.get(meta.macAddress) < clientTimeoutLimit))
                    clients.push(info);
                else {
                    let isClientOk = false;
                    for (let i = 0; i < times.timeForPadById.length; i++) {
                        if (currentTime - times.timeForPadById[i] < clientTimeoutLimit) {
                            isClientOk = true;
                            break;
                        }
                    }
                    if (!isClientOk) {
                        for (let [mac, time] of times.timeForPadByMac) {
                            if (currentTime - time < clientTimeoutLimit) {
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

            for (let i = 0; i < clientsToDelete.length; i++) {
                this.clients.delete(clientsToDelete[i]);
            }

            return clients;
        }
    };
}