import * as path from "path";
import { AppManager } from "./lib/app-manager";

let userDataDir: string;

if (process.platform === "win32"){
    userDataDir = process.env.PORTABLE_EXECUTABLE_DIR || "";
} else { // linux, macos, etc.
    if (process.env.HOME){
        userDataDir = path.join(process.env.HOME, ".config/steam-gyro");
    } else {
        userDataDir = "";
    }
}

if (userDataDir !== undefined) {
    (async () => {
        try {
            await AppManager.create(userDataDir, "steam-gyro.json");
        } catch (error) {
            throw error;
        }
    })();
} else {
    throw new Error("User directory is not set.");
}
