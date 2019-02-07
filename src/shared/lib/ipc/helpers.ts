/**
 * Counter and id based unique value generator.
 *
 * @param id Id used to generate unique value.
 * @param maxPossibleId Max possible id value.
 * @param availableBits Available number of bits to be used by generator (defaults to `32`).
 * @returns Counter and id based unique value generator function.
 */
export function idBasedUniqueIdGenerator(id: number, maxPossibleId: number = 16, availableBits: number = 32) {
    const binaryPlacesForId = maxPossibleId > 0 ? Math.ceil(Math.log2(maxPossibleId)) : 1;
    const maxId = Math.pow(2, availableBits - binaryPlacesForId);

    if (id < 0 || maxPossibleId < 0 || availableBits < 0) {
        throw new Error("Provided arguments cannot be negative.");
    } else if (id > maxPossibleId) {
        throw new Error(`Provided id is bigger than max possible id: ${id} > ${maxPossibleId}.`);
    } else if (maxId < 1) {
        throw new Error("Max possible generated id cannot be lower than 1.");
    } else if (availableBits < 32) {
        throw new Error("Available bits cannot be higher than 32.");
    } else if (binaryPlacesForId > availableBits) {
        throw new Error(`Cannot fit id and uid ranges into ${availableBits} bits.`);
    } else {
        let i = 0;

        return () => {
            let newId: number;
            if (i < maxId) {
                newId = i++;
            } else {
                newId = i = 0;
            }
            return (newId << binaryPlacesForId) | id;
        };
    }
}
