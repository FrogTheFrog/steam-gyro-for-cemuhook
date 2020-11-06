import { DualshockLikeController, UdpServer } from "..";
import { UserSettings } from "../../../shared/models";
import { AppUserInterface } from "./app-user-interface";

/**
 * App module responsible for server and controller logic.
 */
export class AppServer {
    /**
     * Instance of `UdpServer`.
     */
    public serverInstance = new UdpServer();

    /**
     * Instance of `DualshockLikeController`.
     */
    public controller = new DualshockLikeController(0).startWatching();

    /**
     * @param ui User interface module.
     */
    constructor(private ui: AppUserInterface | null) {
        this.serverInstance.addController(this.controller);
    }

    /**
     * Start UDP server with provided settings.
     * @param settings Settings to be used to start UDP server.
     */
    public async start(settings: UserSettings["server"]) {
        await this.serverInstance.start(settings.port, settings.address);
        this.ui?.tray.setToolTip(`Server@${settings.address}:${settings.port}`);
    }

    /**
     * Prepare for app exit.
     */
    public async prepareToExit() {
        await this.serverInstance.stop();
        this.serverInstance.removeController();
        this.controller.stopWatching().close();
    }
}
