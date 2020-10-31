import { BrowserWindow, Menu, nativeImage, Tray } from "electron";
import * as path from "path";
import { BehaviorSubject } from "rxjs";
import { filter, take } from "rxjs/operators";
import * as url from "url";

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
    private loaded: BehaviorSubject<boolean> = new BehaviorSubject(false as boolean);

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
        let iconpath: string;
        if (process.platform === "win32") {
            iconpath = path.join(__dirname, require("../../../../assets/icon.ico").default);
        } else { // linux, macos, etc.
            iconpath = path.join(__dirname, require("../../../../assets/icon.png").default);
        }
        this.icon = nativeImage.createFromPath(iconpath);
        if (!this.icon) {
            throw Error("Could not find tray icon image.");
        }
        this.menu = Menu.buildFromTemplate([
            {
                enabled: false,
                label: "Steam Gyro For Cemuhook",
                type: "normal",
            },
            {
                type: "separator",
            },
            { // Linux icons can't be double clicked
                click: showRendererCallback,
                label: "Show configuration menu",
                type: "normal",
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
     * Open renderer window.
     * @param show Specify whether the renderer must be shown to user.
     */
    public async open(show: boolean) {
        if (this.renderer === null) {
            this.renderer = new BrowserWindow({
                backgroundColor: "#222",
                frame: false,
                height: 700,
                icon: this.icon,
                minHeight: 700,
                minWidth: 1200,
                show: false,
                webPreferences: {
                    devTools: process.env.NODE_ENV !== "production",
                    nodeIntegration: true,
                    enableRemoteModule: true
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

                if (show) {
                    this.renderer!.show();
                }
            });
        } else if (this.loaded.value && !this.renderer.isVisible()) {
            if (this.freeBrowserMemoryTimer !== null) {
                clearTimeout(this.freeBrowserMemoryTimer);
                this.freeBrowserMemoryTimer = null;
            }
            
            if (show) {
                this.renderer.show();
            }
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
     * Indicates whether renderer is ready to display.
     */
    public get ready() {
        return this.loaded.value;
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
