import { dialog } from "electron";
import { AppManager } from "./lib/app-manager";

const userDataDir = process.env.PORTABLE_EXECUTABLE_DIR || "";

if (userDataDir !== undefined) {
    (async () => {
        try {
            await AppManager.create(userDataDir, "steam-gyro.json");
        } catch (error) {
            dialog.showMessageBox({
                message: error,
                title: "Error in Main process",
                type: "error",
            });
        }
    })();
} else {
    dialog.showMessageBox({
        message: "User directory is not set.",
        title: "Error in Main process",
        type: "error",
    });
}
