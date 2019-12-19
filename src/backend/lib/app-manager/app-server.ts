import { UdpServer } from "..";
import { UserSettings } from "../../../shared/models";
import { AppUserInterface } from "./app-user-interface";
import { 
    ControllerMaster, 
    GenericController, 
    MotionDataWithTimestamp 
} from "../../../controller-api";
import { Subject } from "rxjs";
import { privateData } from "../../../shared/lib";


/**
 * Internal class data interface.
 */
interface InternalData {
    addedControllerSubject: Subject<boolean>;
}

/**
 * Private data getter.
 */
const getInternals = privateData() as (self: AppServer, init: InternalData | void) => InternalData;

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
        getInternals(this, {
            addedControllerSubject: new Subject<boolean>()
        });
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
                        getInternals(this).addedControllerSubject.next(true);
                        break;
                    //new controller when first controller was disconnected
                    } else if (
                        !this.activeController.isConnected &&
                        this.activeController.path != controller.path)
                    {
                        this.serverInstance.removeController(controller);
                        this.activeController = controller;
                        getInternals(this).addedControllerSubject.next(true);
                        break;
                    }
                }
            }
            // Removed controller
            for (const controller of removedControllers){
                if (this.activeController!.path == controller.path){
                    this.serverInstance.removeController(controller);
                    getInternals(this).addedControllerSubject.next(false);
                }
            }
        })
        this.ui.tray.setToolTip(`Server@${settings.address}:${settings.port}`);
    }

    public get onAddedController() {
        return getInternals(this).addedControllerSubject.asObservable();
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
