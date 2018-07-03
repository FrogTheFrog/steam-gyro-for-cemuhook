export default class ClientRequestTimes {
    public timeForAllPads: number;
    public timeForPadById: number[];
    public timeForPadByMac: Map<string, number>;

    constructor() {
        this.timeForAllPads = 0;
        this.timeForPadById = [0, 0, 0, 0];
        this.timeForPadByMac = new Map<string, number>();
    }

    public registerPadRequest(regFlags: number, idToReg: number, macToReg: string) {
        const currentData = Date.now();

        if (regFlags === 0) {
            this.timeForAllPads = currentData;
        }
        else {
            if ((regFlags & 0x01) !== 0) {
                if (idToReg < this.timeForPadById.length) {
                    this.timeForPadById[idToReg] = currentData;
                }
            }
            if ((regFlags & 0x02) !== 0) {
                this.timeForPadByMac.set(macToReg, currentData);
            }
        }
    }
}
