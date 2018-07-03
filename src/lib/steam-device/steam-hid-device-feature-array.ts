export default class SteamHidDeviceFeatureArray {
    public dataLength: number = 0;
    public data = new Buffer(62).fill(0);

    constructor(private featureId: number = 0x87) { }

    get array(): number[] {
        return ([] as number[]).concat([this.featureId, this.featureId, this.dataLength], ...this.data);
    }

    public setUint8(setting: number, value: number) {
        this.data[this.dataLength] = setting & 0xFF;
        this.data.writeUInt8(value, this.dataLength + 1);
        this.dataLength += 2;
        return this;
    }

    public setUint16(setting: number, value: number) {
        this.data[this.dataLength] = setting & 0xFF;
        this.data.writeUInt16LE(value, this.dataLength + 1);
        this.dataLength += 3;
        return this;
    }

    public setUint32(setting: number, value: number) {
        this.data[this.dataLength] = setting & 0xFF;
        this.data.writeUInt32LE(value, this.dataLength + 1);
        this.dataLength += 5;
        return this;
    }
}
