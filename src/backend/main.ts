import * as path from "path";
import { AppManager } from "./app-manager";

const userDataDir = process.env.NODE_ENV === "production" ? process.env.PORTABLE_EXECUTABLE_DIR : "";

if (userDataDir !== undefined) {
    const manager = new AppManager(userDataDir, path.join(userDataDir, "steam-gyro.json"));
}
else{
    throw new Error("user directory is not set.");
}
