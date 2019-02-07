import * as fs from "fs-extra";

/**
 * Read JSON file.
 * @param filename A path to a file.
 */
export async function readJson<T>(filename: string) {
    try {
        return await fs.readJson(filename, { throws: true }) as T;
    } catch (error) {
        if (error.code === "ENOENT") {
            return null;
        } else {
            throw error;
        }
    }
}
