import * as fs from "fs-extra";

/**
 * Write JSON file.
 * @param filename A path to a file.
 * @param data Data value to save.
 */
export async function writeJson(filename: string, data: any) {
    return fs.outputJson(filename, data, { spaces: "\t", EOL: "\r\n" });
}
