import { dialog } from "electron";
import { AppManager } from "./lib/app-manager";

const userDataDir = process.env.PORTABLE_EXECUTABLE_DIR || "";

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
