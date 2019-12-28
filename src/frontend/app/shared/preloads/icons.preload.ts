/**
 * Generates `code` field to be used with `val-loader` to load files.
 *
 * @param directory Directory to be used as base.
 * @param extension Extension to be appended to filenames.
 * @param filename Files to load.
 * @returns `string` disguised as JSON object `{ [...filename]: pathToFile }` type.
 */
export function requireFiles<T extends string>(directory: string, extension: string, ...filename: T[]) {
    const map: string[] = [];

    if (directory.length > 0 && directory[directory.length] !== "/") {
        directory += "/";
    }
    if (extension.length > 0 && extension[0] !== ".") {
        extension = `.${extension}`;
    }

    for (const name of filename) {
        map.push(`"${name}": require("${directory}${name}${extension}").default`);
    }

    return `module.exports = {${map.join(", ")}};` as unknown as {
        [key in T]: string;
    };
}

const code = requireFiles("@mdi/svg/svg", "svg",
    "settings",
    "playlist-edit",
    "gamepad",
    "wifi",
    "wifi-off",
    "server",
    "alert-circle-outline",
    "information-outline",
    "air-filter",
    "play",
    "stop",
    "chart-line",
);

export default (() => {
    return {
        cacheable: true,
        code,
    };
}) as unknown as typeof code;
