import { app, BrowserWindow, Menu, nativeImage, shell, Tray } from "electron";
import * as path from "path";
import * as url from "url";
import * as winston from "winston";
import { DualshockGenericController } from "../lib/dualshock-generic-controller";
import GenericController from "../lib/generic-controller";
import { IpcMainManager } from "../lib/helpers/ipc/main";
import { read } from "../lib/helpers/json/read";
import { Validator } from "../lib/helpers/json/validator";
import { write } from "../lib/helpers/json/write";
import { UdpServer } from "../lib/udp-server";
import { IpcMainEvents } from "../models/interface/ipc-main-events.interface";
import { IpcRendererEvents } from "../models/interface/ipc-renderer-events.interface";
import { UserSettings } from "../models/interface/user-settings.interface";
import { UserSettingsModifier } from "../models/modifier/user-settings.modifier";
import { UserSettingSchema } from "../models/schema/user-settings.schema";

export class AppManager {
    public static logError(error: Error) {
        winston.error(error.stack || `${error.name}:\r\n${error.message}`);
    }

    private static icon: nativeImage =
        nativeImage.createFromPath(path.join(__dirname, require("../../assets/icon.ico")));
    private static iconPng: nativeImage = nativeImage.createFromBuffer(AppManager.icon.toPNG());
    
    private settings!: UserSettings;
    private tray: Tray | null = null;
    private renderer: BrowserWindow | null = null;
    private menu: Menu | null = null;
    private rendererIsClosing: boolean = false;
    private freeBrowserMemoryTimer: NodeJS.Timer | null = null;
    private settingsValidator = new Validator(UserSettingSchema, UserSettingsModifier);
    private ipc = new IpcMainManager<IpcMainEvents, IpcRendererEvents>();
    private server = new UdpServer();
    private controller = new GenericController(0).startWatching();

    constructor(private userDataDir: string, private userSettingsPath: string) {
        /* winston.add(winston.transports.File, {
            filename: path.join(userDataDir, "steam-gyro-errors.log"),
            json: false,
            prettyPrint: true,
        }); */
        this.init().then(() => {
            this.showRenderer();
        }).catch((error: Error) => {
            AppManager.logError(error);
        });
    }

    public startServer(settings: UserSettings) {
        return Promise.resolve().then(() => {
            return new Promise<{ address: string, port: number }>((resolve, reject) => {
                try {
                    this.server.start(settings.server.port, settings.server.address, () => {
                        /* this.controller.toggleFilters(settings.enabledFilters);
                        this.controller.setFilters(settings.filters); */
                        resolve(settings.server);
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }).then((data) => {
            this.tray!.displayBalloon({
                content: `Running@${data.address}:${data.port}`,
                icon: AppManager.iconPng,
                title: "UDP server started",
            });
            this.tray!.setToolTip(`Server@${data.address}:${data.port}`);
        });
    }

    public readUserSettings(filePath: string) {
        return read<UserSettings>(filePath).then((data) => {
            if (data !== null) {
                if (!this.settingsValidator.validate(data).isValid()) {
                    throw new Error(this.settingsValidator.errorString);
                }

                return data;
            }
            else {
                data = this.settingsValidator.getDefaultValues() as UserSettings;
                return write(filePath, data).then(() => data as UserSettings);
            }
        });
    }

    public showRenderer() {
        return Promise.resolve().then(() => {
            if (this.renderer === null) {
                this.renderer = new BrowserWindow({
                    minWidth: 920,
                    // tslint:disable-next-line:object-literal-sort-keys
                    minHeight: 600,
                    width: 920,
                    height: 600,
                    show: false,
                    frame: false,
                    backgroundColor: "#303030",
                    webPreferences: {
                        devTools: process.env.NODE_ENV !== "production",
                    },
                });

                // Load web based interface
                this.renderer.loadURL(url.format({
                    pathname: path.join(__dirname, "renderer", "index.html"),
                    protocol: "file:",
                    slashes: true,
                }));

                // Prevent url opening in renderer itself. Use default browser instead
                this.renderer.webContents.on("will-navigate", (event, requestedUrl) => {
                    event.preventDefault();
                    shell.openExternal(requestedUrl);
                });

                // Hide window instead of closing it
                this.renderer.on("close", (event: Event) => {
                    if (!this.rendererIsClosing) {
                        if (this.freeBrowserMemoryTimer === null) {
                            this.freeBrowserMemoryTimer = global.setTimeout(
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
                });

                // Wait until everything is loaded
                this.ipc.once("angularLoaded", () => {
                    this.renderer!.show();
                });
            }
            else if (!this.renderer.isVisible()) {
                if (this.freeBrowserMemoryTimer !== null) {
                    clearTimeout(this.freeBrowserMemoryTimer);
                    this.freeBrowserMemoryTimer = null;
                }

                this.renderer.show();
            }
        });
    }

    public showError(error: Error) {
        return this.showRenderer().then(() => {
            if (this.renderer !== null) {
                this.renderer.webContents.send("displayError", error);
            }
        });
    }

    public exit() {
        this.rendererIsClosing = true;

        this.server.stop();
        this.server.removeController();
        this.controller.stopWatching().close();

        if (this.renderer !== null) {
            this.renderer.close();
        }

        app.quit();
    }

    private init() {
        // tslint:disable-next-line:no-empty
        if (app.makeSingleInstance(() => { })) {
            this.exit();
        }

        // Start init
        return Promise.resolve().then(() => {
            if (!app.isReady()) {
                return new Promise<void>((resolve) => {
                    app.once("ready", resolve);
                });
            }
        }).then(() => {
            // Required for MacOS
            app.on("activate", this.showRenderer.bind(this));

            // Prevent app exit upon renderer window close
            app.on("window-all-closed", (event: Event) => event.preventDefault());

            // Read user settings
            return this.readUserSettings(this.userSettingsPath);
        }).then((settings) => {
            this.settings = settings;
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
                    click: () => {
                        this.startServer(this.settings).catch((error: Error) => {
                            this.showError(error);
                        });
                    },
                    label: "Restart server",
                    type: "normal",
                },
                {
                    click: this.exit.bind(this),
                    label: "Exit",
                    type: "normal",
                },
            ]);

            this.tray = new Tray(AppManager.icon);
            this.tray.setContextMenu(this.menu);
            this.tray.on("click", this.showRenderer.bind(this));

            this.server.addController(this.controller as DualshockGenericController);

            this.bindEvents();

            return this.startServer(this.settings);
        });
    }

    private bindEvents() {
        this.ipc.on("getUserSettings", (data, response) => {
            response("userSettings", this.settings);
        });
        /* ipcMain.on('nonfatalError', (event, data) => {
            winston.error(data.error.stack);
        }).on('restartServer', (event) => {
            startServer({ userSettings: currentSettings });
        }).on('getUserSettings', (event) => {
            event.sender.send('userSettings', currentSettings);
        }).on('saveUserSettings', (event, data) => {
            currentSettings = data;
            json.write(defaultUserSettingsFile, currentSettings).then().catch((error) => {
                winston.error('FATAL ERROR!');
                winston.error(error);
                exitApp(error);
            });
        }).on('updateServer', (event, data) => {
            currentSettings.server = data;
        }).on('toggleSilentErrors', (event, silentErrors) => {
            currentSettings.silentErrors = silentErrors;
        }).on('getSteamDevices', (event) => {
            event.sender.send('steamDevices', SteamDevice.SteamDevice.getItems(true).concat(SteamDevice.SteamDevice.getExcludedItems()));
        }).on('closeSteamDevice', (event) => {
            controller.close();
            event.sender.send('deviceChanged', SteamDevice.SteamDevice.getItems(true).concat(SteamDevice.SteamDevice.getExcludedItems()));
        }).on('openSteamDevice', (event, devicePath) => {
            controller.open({ activeOnly: false, autoClose: true, devicePath });
            event.sender.send('deviceChanged', SteamDevice.SteamDevice.getItems(true).concat(SteamDevice.SteamDevice.getExcludedItems()));
        }).on('startDataSteam', (event) => {
            if (controller.listeners('SC_ReportByRef').length === 0)
                controller.on('SC_ReportByRef', dataStreamCallback);
        }).on('stopDataSteam', (event) => {
            controller.removeListener('SC_ReportByRef', dataStreamCallback);
        }); */
    }
}
