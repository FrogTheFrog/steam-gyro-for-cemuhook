import { app } from "electron";
import * as path from "path";
import { Subscription } from "rxjs";
import { createLogger, format, Logger, transports } from "winston";
import { IpcEvents, MessageObject } from "../../../shared/models";
import { IpcMain } from "../ipc-main";
import { AppServer } from "./app-server";
import { AppUserInterface } from "./app-user-interface";
import { AppUserSettings } from "./app-user-settings";

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

            // Required for MacOS
            app.on("activate", () => ui.show().catch((error) => manager.logError(error, { isFatal: true })));

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
                ui.show().catch((error) => manager.logError(error, { isFatal: true }));
            };

            const ipc = new IpcMain<IpcEvents>();
            const ui = new AppUserInterface(exitCallback, serverRestartCallback, showRendererCallback);
            const settings = new AppUserSettings();
            const server = new AppServer(ui);
            const manager = new AppManager(ui, settings, server, ipc, userDirectory, settingsFilename);

            const settingsPath = path.join(userDirectory, settingsFilename);

            try {
                const readSettings = await settings.readSettings(settingsPath);
                if (readSettings !== null) {
                    settings.current = readSettings;
                }
                await server.start(settings.current.server);
            } catch (error) {
                manager.logError(error, { display: true });
                settings.savingDisabled = true;
            }

            return manager;
        }
    }

    /**
     * Stores various subscriptions.
     */
    private subscriptions: Subscription;

    /**
     * Full path to settings file.
     */
    private settingsPath: string;

    /**
     * Instance of winston logger.
     */
    private logger: Logger;

    /**
     * All received and emitter messages.
     */
    private messages: MessageObject[] = [];

    private constructor(
        private ui: AppUserInterface,
        private settings: AppUserSettings,
        private server: AppServer,
        private ipc: IpcMain<IpcEvents>,
        private userDirectory: string,
        private settingsFilename: string,
    ) {
        this.logger = createLogger({
            exitOnError: false,
            format: format.combine(
                format.timestamp(),
                format.printf(({ message, timestamp }) => {
                    return `[${timestamp}] ${message}`;
                }),
            ),
            transports: [
                new transports.Console({ level: "silly" }),
                new transports.File({ level: "error", filename: path.join(this.userDirectory, "sgfc.log") }),
            ],
        });
        const logDeviceInfo = (data: string | null, isConnected: boolean) => {
            if (data !== null) {
                this.logInfo(`Device status: ${isConnected ? "Connected" : "Disconnected"}`, { stack: data });
            }
        };
        logDeviceInfo(this.server.controller.infoString, this.server.controller.isOpen());

        this.settingsPath = path.join(this.userDirectory, this.settingsFilename);
        this.ipc.receiver.onError.add((error) => this.logError(error, { isFatal: true }));
        this.bindEvents();

        this.subscriptions = new Subscription();
        this.subscriptions.add(this.server.serverInstance.onError.subscribe((value) => {
            this.logError(value, { display: true });
        })).add(this.server.controller.onOpenClose.subscribe((value) => {
            logDeviceInfo(value.info, value.status);
        }));
    }

    /**
     * Clean up and exit app.
     */
    public async exit() {
        await this.server.prepareToExit();
        this.ui.prepareToExit();
        this.ipc.receiver
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
        this.logMessageToRendered(message, display);
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
            this.logMessageToRendered(message, display);
        }
    }

    /**
     * Emits message to be logged by renderer.
     * @param message Message to log.
     * @param display Specify whether the message should be displayed explicitly to user.
     */
    public logMessageToRendered(message: MessageObject, display: boolean = false) {
        const index = this.messages.push(message) - 1;

        if (display) {
            this.ui.show()
                .then((renderer) => {
                    this.ipc.createSender(renderer.webContents).notify(
                        "POST",
                        "sync-messages",
                        {
                            displayIndex: index,
                        },
                    );
                }).catch((value) => this.logError(value, { isFatal: true }));
        }
    }

    /**
     * Assign server related events.
     */
    private serverEvents() {
        const serverSettings = Object.assign({}, this.settings.current.server);

        this.ipc.receiver.on("GET", "settings:server", () => {
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

        this.ipc.receiver.on("POST", "data-stream", (stream, response) => {
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
        this.ipc.receiver.on("GET", "settings:filter", () => {
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

        this.ipc.receiver.on("POST", "device-status", (streamStatus, response) => {
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

        this.ipc.receiver.on("POST", "connection-status", (streamStatus, response) => {
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

        this.ipc.receiver.on("POST", "motion-data-stream", (stream, response) => {
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
        this.ipc.receiver.on("POST", "sync-messages", (message) => {
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
