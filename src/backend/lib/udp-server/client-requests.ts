import { ClientRequestRegFlags } from "../../models";

/**
 * Helper class for handling clients.
 */
export class ClientRequests {
    /**
     * Elapsed time for all pads.
     */
    public timeForAllPads = 0;

    /**
     * Elapsed time for pads by ID.
     */
    public timeForPadById = [0, 0, 0, 0];

    /**
     * Elapsed time for pads by MAC.
     */
    public timeForPadByMac = new Map<string, number>();

    /**
     * Store client request time.
     * @param regFlags Flags specifying how to store.
     * @param idToReg ID to store by.
     * @param macToReg MAC to store by.
     */
    public registerPadRequest(regFlags: ClientRequestRegFlags, idToReg: number, macToReg: string) {
        const currentDate = Date.now();

        if (regFlags === ClientRequestRegFlags.All) {
            this.timeForAllPads = currentDate;
        } else {
            if ((regFlags & ClientRequestRegFlags.Id) !== 0) {
                if (idToReg < this.timeForPadById.length) {
                    this.timeForPadById[idToReg] = currentDate;
                }
            }
            if ((regFlags & ClientRequestRegFlags.Mac) !== 0) {
                this.timeForPadByMac.set(macToReg, currentDate);
            }
        }
    }
}
