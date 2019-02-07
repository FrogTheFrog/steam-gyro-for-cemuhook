import { UniqueID, UniqueIDGenerator } from "../../models";

/**
 * Manages ids used by IPC.
 */
export class IpcId {
    /**
     * Currently used ids.
     */
    private static usedIds = new Set<UniqueID>();

    /**
     * @param uidGenerator Generator function used to generate ids.
     * @param maxIterations Amount of times the `uidGenerator` can produce duplicate ids.
     */
    constructor(private uidGenerator: UniqueIDGenerator, public maxIterations: number = 100) {
    }

    /**
     * Check if given id is being used.
     * @param id Id to check for.
     * @returns `true` if id is being used.
     */
    public has(id: UniqueID) {
        return IpcId.usedIds.has(id);
    }

    /**
     * Tries to add id to the list of used ids.
     * @param id Id to add.
     * @returns `true` if id is unique and been added, `false` otherwise.
     */
    public add(id: UniqueID) {
        if (!this.has(id)) {
            IpcId.usedIds.add(id);
            return true;
        } else {
            return false;
        }
    }

    /**
     * Generate new id with provided generator and adds it to used ids list.
     * @returns Generated id.
     */
    public generate() {
        let maxIterations = this.maxIterations;
        while (maxIterations-- >= 0) {
            const id = this.uidGenerator();
            if (this.add(id)) {
                return id;
            }
        }
        throw new Error("\"uuidGenerator\" is not efficient enough or does not generate unique ids at all.");
    }

    /**
     * Removes id from used ids list.
     * @param id Id to remove.
     */
    public remove(id: UniqueID) {
        IpcId.usedIds.delete(id);
        return this;
    }
}
