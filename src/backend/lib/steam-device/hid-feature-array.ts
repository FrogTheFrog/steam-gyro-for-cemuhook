/**
 * Class wrapper for hid communication.
 */
export class HidFeatureArray {
    public dataLength: number = 0;
    public data = new Buffer(62).fill(0);

    /**
     * @param featureId First leading byte in array.
     */
    constructor(private featureId: number = 0x87) {
        this.featureId = this.featureId & 0xFF;
    }

    /**
     * Returns a 62 bytes long array.
     */
    get array(): number[] {
        return ([] as number[]).concat([0, this.featureId, this.dataLength], ...this.data);
    }

    /**
     * Appends value to array.
     * @param setting Settings value.
     * @param value Value to append.
     */
    public appendUint8(setting: number, value: number) {
        this.data[this.dataLength] = setting & 0xFF;
        this.data.writeUInt8(value, this.dataLength + 1);
        this.dataLength += 2;
        return this;
    }

    /**
     * Appends value to array.
     * @param setting Settings value.
     * @param value Value to append.
     */
    public appendUint16(setting: number, value: number) {
        this.data[this.dataLength] = setting & 0xFF;
        this.data.writeUInt16LE(value, this.dataLength + 1);
        this.dataLength += 3;
        return this;
    }

    /**
     * Appends value to array.
     * @param setting Settings value.
     * @param value Value to append.
     */
    public appendUint32(setting: number, value: number) {
        this.data[this.dataLength] = setting & 0xFF;
        this.data.writeUInt32LE(value, this.dataLength + 1);
        this.dataLength += 5;
        return this;
    }
}
