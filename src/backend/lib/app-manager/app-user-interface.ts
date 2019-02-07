import { BrowserWindow, Menu, nativeImage, Tray } from "electron";
import * as path from "path";
import { BehaviorSubject } from "rxjs";
import { filter, take } from "rxjs/operators";
import * as url from "url";
import { IpcEvents } from "../../../shared/models";
import { IpcMain } from "../ipc-main";

/**
 * App module responsible for UI resources.
 */
export class AppUserInterface {
    /**
     * Icon resource.
     */
    public icon: nativeImage;

    /**
     * Instance of `Tray`.
     */
    public tray: Tray;

    /**
     * Instance of `Menu`.
     */
    public menu: Menu;

    /**
     * Instance of `BrowserWindow` or `null` if the window is closed.
     */
    private renderer: BrowserWindow | null = null;

    /**
     * Indicated whether renderer has loaded or not.
     */
    private loaded: BehaviorSubject<boolean> = new BehaviorSubject(false);

    /**
     * Specify if renderer is really closing.
     */
    private rendererIsClosing: boolean = false;

    /**
     * Timer until browser memory should be released.
     */
    private freeBrowserMemoryTimer: NodeJS.Timer | null = null;

    /**
     * @param exitCallback Callback for when user clicks on "Exit" on menu.
     * @param serverRestartCallback Callback for when user tries to restart server from menu.
     * @param showRendererCallback Callback for when user wants to show renderer window.
     */
    constructor(
        exitCallback: () => void,
        serverRestartCallback: () => void,
        showRendererCallback: () => void,
    ) {
        this.icon = nativeImage.createFromPath(path.join(__dirname, require("../../../../assets/icon.ico")));

        this.menu = Menu.buildFromTemplate([
            {
                enabled: false,
                label: "Steam Gyro For Cemuhook",
                type: "normal",
            },
            {
                type: "separator",
            },
            {
                click: serverRestartCallback,
                label: "Restart server",
                type: "normal",
            },
            {
                click: exitCallback,
                label: "Exit",
                type: "normal",
            },
        ]);

        this.tray = new Tray(this.icon);
        this.tray.setContextMenu(this.menu);
        this.tray.on("click", showRendererCallback);
    }

    /**
     * Show renderer window.
     */
    public async show() {
        if (this.renderer === null) {
            this.renderer = new BrowserWindow({
                backgroundColor: "#222",
                frame: false,
                height: 700,
                minHeight: 700,
                minWidth: 1200,
                show: false,
                webPreferences: {
                    devTools: process.env.NODE_ENV !== "production",
                    nodeIntegration: true,
                },
                width: 1200,
            });

            // Load web based interface
            this.renderer.loadURL(url.format({
                pathname: path.join(__dirname, "frontend", "index.html"),
                protocol: "file:",
                slashes: true,
            }));

            // Hide window instead of closing it
            this.renderer.on("close", (event: Event) => {
                if (!this.rendererIsClosing) {
                    if (this.freeBrowserMemoryTimer === null) {
                        this.freeBrowserMemoryTimer = setTimeout(
                            () => this.renderer ? this.renderer.close() : null,
                            5000,
                        );
                        event.preventDefault();
                        this.renderer!.hide();
                        return;
                    }
                }

                if (this.freeBrowserMemoryTimer !== null) {
                    clearTimeout(this.freeBrowserMemoryTimer);
                    this.freeBrowserMemoryTimer = null;
                }
            });

            // Destroy window
            this.renderer.on("closed", () => {
                this.renderer = null;
                this.loaded.next(false);
            });

            // Wait until everything is loaded
            this.renderer.webContents.once("did-finish-load", () => {
                this.loaded.next(true);
                this.renderer!.show();
            });
        } else if (this.loaded.value && !this.renderer.isVisible()) {
            if (this.freeBrowserMemoryTimer !== null) {
                clearTimeout(this.freeBrowserMemoryTimer);
                this.freeBrowserMemoryTimer = null;
            }
            this.renderer.show();
        }

        if (this.loaded.value) {
            return this.renderer;
        } else {
            return this.loaded
                .asObservable()
                .pipe(
                    filter((value) => value),
                    take(1),
                )
                .toPromise()
                .then(() => this.renderer!);
        }
    }

    /**
     * Prepare for app exit.
     */
    public prepareToExit() {
        this.rendererIsClosing = true;
        if (this.renderer !== null) {
            this.renderer.close();
            this.renderer = null;
        }
    }
}
