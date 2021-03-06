import { app } from "electron";
import * as path from "path";
import { Subscription } from "rxjs";
import { createLogger, format, Logger, transports } from "winston";
import { IpcEvents, MessageObject } from "../../../shared/models";
import { IpcMain } from "../ipc-main";
import { AppServer } from "./app-server";
import { AppUserInterface } from "./app-user-interface";
import { AppUserSettings } from "./app-user-settings";

// Disable hardware acceleration as it is currently not needed.
app.disableHardwareAcceleration();

/**
 * Module responsible for handling main app logic.
 */
export class AppManager {
    /**
     * Create `AppManager` instance.
     *
     * @param userDirectory Directory where settings and error log will be stored.
     * @param settingsFilename Filename of settings file.
     * @returns `AppManager` instance or nothing if other instance of app is already running.
     */
    public static async create(userDirectory: string, settingsFilename: string) {
        if (app.requestSingleInstanceLock()) {
            await app.whenReady();

            const settingsPath = path.join(userDirectory, settingsFilename);
            const settings = new AppUserSettings();

            let lastSettingsReadError: Error | null = null;

            try {
                const readSettings = await settings.readSettings(settingsPath);
                settings.current = readSettings !== null ? readSettings : settings.current;
            } catch (error) {
                lastSettingsReadError = error;
            }

            let ipc: IpcMain<IpcEvents> | null = null;
            let ui: AppUserInterface | null = null;

            if (!settings.current.headless) {
                // Required for MacOS
                app.on("activate", () => ui?.open(true).catch((error) => manager.logError(error, { isFatal: true })));

                // Prevent app exit upon renderer window close
                app.on("window-all-closed", (event: Event) => {
                    event.preventDefault();
                });

                const exitCallback = () => {
                    manager.exit().catch((error) => manager.logError(error, { isFatal: true }));
                };
                const serverRestartCallback = () => {
                    server.start(settings.current.server).catch((error) => manager.logError(error, { isFatal: true }));
                };
                const showRendererCallback = () => {
                    ui?.open(true).catch((error) => manager.logError(error, { isFatal: true }));
                };

                ui = new AppUserInterface(exitCallback, serverRestartCallback, showRendererCallback);
                ipc = new IpcMain<IpcEvents>();
            }

            const server = new AppServer(ui);
            const manager = new AppManager(ui, settings, server, ipc, userDirectory, settingsPath);

            if (lastSettingsReadError !== null) {
                manager.logError(lastSettingsReadError, { display: true });
            }
            else {
                try {
                    const serverSettings = settings.current.server;
                    await server.start(serverSettings);
                    manager.logInfo(`Started server@${serverSettings.address}:${serverSettings.port}`);
                } catch (error) {
                    manager.logError(error, { display: true });
                    if (settings.current.headless) {
                        manager.logError(new Error("Exiting the app since nothing can be done in headless mode!"),
                            { isFatal: true });
                    }
                }
            }

            return manager;
        }
    }

    /**
     * Stores various subscriptions.
     */
    private subscriptions = new Subscription();

    /**
     * Instance of winston logger.
     */
    private logger: Logger;

    /**
     * All received and emitter messages.
     */
    private messages: MessageObject[] = [];

    private constructor(
        private ui: AppUserInterface | null,
        private settings: AppUserSettings,
        private server: AppServer,
        private ipc: IpcMain<IpcEvents> | null,
        private userDirectory: string,
        private settingsPath: string,
    ) {
        // Create logger before anything else
        this.logger = createLogger({
            exitOnError: false,
            format: format.combine(
                format.timestamp(),
                format.printf((data) => {
                    return `[${data.timestamp}] ${data.stack || data.message}`;
                }),
            ),
            transports: [
                new transports.Console({ level: "silly" }),
                new transports.File({ level: "error", filename: path.join(this.userDirectory, "sgfc.log") }),
            ],
        });

        // Verify headless mode validity
        if (settings.current.headless !== (this.ui === null && this.ipc === null)) {
            this.logError(new Error(`Invalid headless mode!`), { isFatal: true });
            return;
        }

        // Setup connections to UI if possible
        this.ipc?.receiver.onError.add((error) => this.logError(error, { isFatal: true }));
        this.bindEvents();

        // Try to get current controller status before subscribing
        const logDeviceInfo = (data: string | null, isConnected: boolean) => {
            if (data !== null) {
                this.logInfo(`Device status: ${isConnected ? "Connected" : "Disconnected"}`, { stack: data });
            }
        };
        logDeviceInfo(this.server.controller.infoString, this.server.controller.isOpen());

        // Add various event subscriptions
        this.subscriptions.add(this.server.serverInstance.onError.subscribe((value) => {
            this.logError(value, { display: true });
        })).add(this.server.serverInstance.onInfo.subscribe((value) => {
            this.logInfo(value);
        })).add(this.server.controller.onOpenClose.subscribe((value) => {
            logDeviceInfo(value.info, value.status);
        }));

        // Log a message to output
        this.logInfo(`App started successfully${settings.current.headless ? " in headless mode" : ""}.`);
    }

    /**
     * Clean up and exit app.
     */
    public async exit() {
        await this.server.prepareToExit();
        this.ui?.prepareToExit();
        this.ipc?.receiver
            .removeDataHandler(false)
            .removeNotification(false);
        this.subscriptions.unsubscribe();

        app.quit();
    }

    /**
     * Log info message and optionally display it on renderer.
     * @param info Info to send.
     * @param options Additional actions to do.
     */
    public logInfo(info: string, options?: { stack?: string, display?: boolean }) {
        // tslint:disable-next-line: no-unnecessary-initializer
        const { stack = undefined, display = false } = options || {};
        const message: MessageObject = {
            data: { message: info, stack },
            type: "info",
        };

        this.logger.info(`${info}${stack ? `\n${stack}` : ""}`);
        this.logMessageToRenderer(message, display);
    }

    /**
     * Log error and optionally exit app or display it on renderer.
     * @param error Error to log.
     * @param options Additional actions to do.
     */
    public logError(error: Error, options?: { isFatal?: boolean, display?: boolean }) {
        const { isFatal = false, display = false } = options || {};
        const message: MessageObject = {
            data: { name: error.name, message: error.message, stack: error.stack },
            type: "error",
        };

        this.logger.error(error);

        if (isFatal) {
            Promise.resolve(this.exit());
        } else {
            this.logMessageToRenderer(message, display);
        }
    }

    /**
     * Emits message to be logged by renderer.
     * @param message Message to log.
     * @param display Specify whether the message should be displayed explicitly to user.
     */
    public logMessageToRenderer(message: MessageObject, display: boolean = false) {
        const index = this.messages.push(message) - 1;

        if (this.ui !== null) {
            if (display || this.ui.ready) {
                this.ui.open(display)
                    .then((renderer) => {
                        this.ipc!.createSender(renderer.webContents).notify(
                            "POST",
                            "sync-messages",
                            {
                                displayIndex: display ? index : undefined,
                            },
                        );
                    }).catch((value) => this.logError(value, { isFatal: true }));
            }
        }
    }

    /**
     * Assign server related events.
     */
    private serverEvents() {
        const serverSettings = Object.assign({}, this.settings.current.server);

        this.ipc?.receiver.on("GET", "settings:server", () => {
            return serverSettings;
        }).on("PUT", "settings:server:address", (data) => {
            serverSettings.address = data;
        }).on("PUT", "settings:server:port", (data) => {
            serverSettings.port = data;
        }).on("POST", "restart-server", (data, sender) => {
            return this.server.start(serverSettings).then(() => {
                this.settings.current.server = Object.assign({}, serverSettings);
                return this.settings.writeSettings(this.settingsPath);
            }).then(() => {
                this.logInfo(`Restarted server @${serverSettings.address}:${serverSettings.port}`, { display: true });
            }).catch((error) => {
                this.logError(error, { display: true });
            });
        });
    }

    /**
     * Assign data stream related events.
     */
    private dataStreamEvents() {
        let subscription: Subscription = new Subscription();

        this.ipc?.receiver.on("POST", "data-stream", (stream, response) => {
            this.subscriptions.remove(subscription);
            subscription.unsubscribe();
            if (stream) {
                subscription = this.server.controller.onReport.subscribe((data) => {
                    response.notify("PUT", "data-stream", data);
                });
                this.subscriptions.add(subscription);
            }
        });
    }

    /**
     * Assign filter related events.
     */
    private filterEvents() {
        this.ipc?.receiver.on("GET", "settings:filter", () => {
            return this.settings.current.filter;
        }).on("PUT", "settings:filter", (data) => {
            this.settings.current.filter.type = data.type;
            (this.settings.current.filter.data[data.type] as number[]) = data.value;

            this.server.controller.setFilter(data);

            this.settings.writeSettings(this.settingsPath)
                .catch((error) => this.logError(error, { isFatal: true }));
        });
    }

    /**
     * Assign device status change related events.
     */
    private deviceStatusEvents() {
        let subscription: Subscription = new Subscription();

        this.ipc?.receiver.on("POST", "device-status", (streamStatus, response) => {
            this.subscriptions.remove(subscription);
            subscription.unsubscribe();
            if (streamStatus) {
                subscription = this.server.controller.onOpenClose.subscribe((value) => {
                    response.notify("PUT", "device-status", value.status);
                });
                this.subscriptions.add(subscription);
                response.notify("PUT", "device-status", this.server.controller.isOpen());
            }
        });
    }

    /**
     * Assign UDP related events.
     */
    private connectionStatusEvents() {
        let subscription: Subscription = new Subscription();

        this.ipc?.receiver.on("POST", "connection-status", (streamStatus, response) => {
            this.subscriptions.remove(subscription);
            subscription.unsubscribe();
            if (streamStatus) {
                subscription = this.server.serverInstance.onStatusChange.subscribe((value) => {
                    response.notify("PUT", "connection-status", value);
                });
                this.subscriptions.add(subscription);
            }
        });
    }

    /**
     * Assign motion data related events.
     */
    private motionDataEvents() {
        let subscription: Subscription = new Subscription();

        this.ipc?.receiver.on("POST", "motion-data-stream", (stream, response) => {
            this.subscriptions.remove(subscription);
            subscription.unsubscribe();
            if (stream) {
                subscription = this.server.controller.onMotionsData.subscribe((data) => {
                    response.notify("POST", "motion-data-stream", data);
                });
                this.subscriptions.add(subscription);
            }
        });
    }

    /**
     * Assign message exchange related events.
     */
    private messageEvents() {
        this.ipc?.receiver.on("POST", "sync-messages", (message) => {
            if (message.type === "error") {
                this.logError(message.data);
            } else {
                this.logInfo(message.data.message, { stack: message.data.stack });
            }
        }).on("GET", "messages", (sliceAtIndex) => {
            return this.messages.slice(sliceAtIndex);
        });
    }

    /**
     * Bind all of the events.
     */
    private bindEvents() {
        this.serverEvents();
        this.dataStreamEvents();
        this.filterEvents();
        this.motionDataEvents();
        this.deviceStatusEvents();
        this.connectionStatusEvents();
        this.messageEvents();
    }
}
