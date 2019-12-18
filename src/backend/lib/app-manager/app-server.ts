import { UdpServer } from "..";
import { UserSettings } from "../../../shared/models";
import { AppUserInterface } from "./app-user-interface";
import { 
    ControllerMaster, 
    GenericController, 
    MotionDataWithTimestamp 
} from "../../../controller-api";

/**
 * App module responsible for server and controller logic.
 */
export class AppServer {
    /**
     * Instance of `UdpServer`.
     */
    public serverInstance: UdpServer;

    /**
     * Instance of `DualshockLikeController`.
     */
    public controllerMaster = new ControllerMaster();

    public activeController: GenericController<MotionDataWithTimestamp> | null;

    /**
     * @param ui User interface module.
     */
    constructor(private ui: AppUserInterface) {
        this.activeController = null;
        this.serverInstance = new UdpServer(this.controllerMaster);
    }

    /**
     * Start UDP server with provided settings.
     * @param settings Settings to be used to start UDP server.
     */
    public async start(settings: UserSettings["server"]) {
        await this.serverInstance.start(settings.port, settings.address);
        this.controllerMaster.startAutoScanning();
        this.controllerMaster.onListChange.subscribe(({addedControllers, removedControllers})=>{
            for (const controller of addedControllers){
                if (controller.isConnected){
                    // If no current controller, just add the first controller detected then break
                    if ( this.activeController == null ){
                        this.activeController = controller;
                        this.serverInstance.addController(controller);
                        break;
                    //new controller when first controller was disconnected
                    } else if (
                        controller.isConnected &&
                        !this.activeController.isConnected &&
                        this.activeController.path != controller.path)
                    {
                        this.serverInstance.removeController(controller);
                        this.activeController = controller;
                        break;
                    }
                }
            }
            for (const controller of removedControllers){
                if (this.activeController!.path == controller.path){
                    this.serverInstance.removeController(controller);
                }
            }
        })
        this.ui.tray.setToolTip(`Server@${settings.address}:${settings.port}`);
    }

    /**
     * Prepare for app exit.
     */
    public async prepareToExit() {
        await this.serverInstance.stop();
        this.serverInstance.removeController();
        this.controllerMaster.stopAutoScanning();
    }
}
