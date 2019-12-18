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
            app.on("activate", () => ui.show().catch((error) => manager.emitError(error, { isFatal: true })));

            // Prevent app exit upon renderer window close
            app.on("window-all-closed", (event: Event) => {
                event.preventDefault();
            });

            const exitCallback = () => {
                manager.exit().catch((error) => manager.emitError(error, { isFatal: true }));
            };
            const serverRestartCallback = () => {
                server.start(settings.current.server).catch((error) => manager.emitError(error, { isFatal: true }));
            };
            const showRendererCallback = () => {
                ui.show().catch((error) => manager.emitError(error, { isFatal: true }));
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
                manager.emitError(error, { display: true });
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
    private logger: Logger | null = null;

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
        this.settingsPath = path.join(this.userDirectory, this.settingsFilename);
        this.ipc.receiver.onError.add((error) => this.emitError(error, { isFatal: true }));
        this.bindEvents();

        this.subscriptions = this.server.serverInstance.onError.subscribe((value) => {
            this.emitError(value, { display: true });
        });
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
     * Log error and optionally exit app or display it on renderer.
     * @param error Error to log.
     * @param options Additional actions to do.
     */
    public emitError(error: Error, options?: { isFatal?: boolean, display?: boolean }) {
        const { isFatal = false, display = false } = options || {};
        const message: MessageObject = {
            data: { name: error.name, message: error.message, stack: error.stack },
            type: "error",
        };

        if (this.logger === null) {
            this.logger = createLogger({
                exitOnError: false,
                format: format.combine(
                    format.timestamp(),
                    format.printf(({ stack, timestamp }) => {
                        return `[${timestamp}] ${stack}`;
                    }),
                ),
                level: "error",
                transports: [
                    new transports.File({ filename: path.join(this.userDirectory, "sgfc.log") }),
                ],
            });
        }

        this.logger.error(error);

        Promise.resolve()
            .then(() => {
                if (isFatal) {
                    return this.exit();
                } else if (display) {
                    return this.ui.show()
                        .then((renderer) => {
                            return this.ipc.createSender(renderer.webContents).request(
                                "POST",
                                "message",
                                {
                                    display: true,
                                    message,
                                },
                            ) as Promise<unknown>;
                        });
                }
            }).then(() => {
                this.messages.push(message);
            }).catch((value) => this.emitError(value, { isFatal: true }));
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
                const message: MessageObject = {
                    data: `Restarted server @${serverSettings.address}:${serverSettings.port}`,
                    type: "info",
                };

                this.messages.push(message);

                sender.request("POST", "message", {
                    display: true,
                    message,
                }).catch((error) => this.emitError(error, { isFatal: true }));
            }).catch((error) => {
                this.emitError(error, { display: true });
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
                subscription = this.server.activeController!.onReport.subscribe((data) => {
                    response.request("PUT", "data-stream", data)
                        .catch((error) => this.emitError(error, { isFatal: true }));
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

            this.server.activeController!.setFilter(data);

            this.settings.writeSettings(this.settingsPath)
                .catch((error) => this.emitError(error, { isFatal: true }));
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
                subscription = this.server.activeController!.onOpenClose.subscribe((value) => {
                    response.request("PUT", "device-status", value)
                        .catch((error) => this.emitError(error, { isFatal: true }));
                });
                this.subscriptions.add(subscription);
                response.request("PUT", "device-status", this.server.activeController!.isOpen())
                    .catch((error) => this.emitError(error, { isFatal: true }));
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
                subscription = this.server.serverInstance!.onStatusChange.subscribe((value) => {
                    response.request("PUT", "connection-status", value)
                        .catch((error) => this.emitError(error, { isFatal: true }));
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
                subscription = this.server.activeController!.onMotionsData.subscribe((data) => {
                    response.request("POST", "motion-data-stream", data)
                        .catch((error) => this.emitError(error, { isFatal: true }));
                });
                this.subscriptions.add(subscription);
            }
        });
    }

    /**
     * Assign message exchange related events.
     */
    private messageEvents() {
        this.ipc.receiver.on("POST", "message", (message) => {
            if (message.type === "error") {
                this.emitError(message.data);
            } else {
                this.messages.push(message);
            }
        }).on("GET", "messages", () => {
            return this.messages;
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
