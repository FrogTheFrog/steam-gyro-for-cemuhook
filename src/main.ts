import { app, Menu, Tray, dialog, nativeImage, BrowserWindow, shell, ipcMain, WebContents } from 'electron';
import { UdpServer } from './lib/udp-server';
import { SteamController } from "./lib/steam-controller";
import { SteamDevice } from './lib/steam-device'
import { json, validator } from "./lib/helpers";
import { userSettings } from "./lib/settings.model";
import * as _ from 'lodash';
import * as winston from "winston";
import * as fs from 'fs-extra';
import * as path from 'path';
import * as url from 'url';

let tray: Tray = null;
let contextMenu: Menu = null;
let rendererWindow: BrowserWindow = null;
let isClosing: boolean = false;
let freeBrowserMemoryTimer: NodeJS.Timer = undefined;

let icon: nativeImage = nativeImage.createFromPath(path.join(__dirname, require('../assets/icon.ico')));
let iconPng: nativeImage = nativeImage.createFromBuffer(icon.toPNG());

let userDataDir: string = process.env.PORTABLE_EXECUTABLE_DIR || '';
let defaultUserSettingsFile = path.join(userDataDir, 'steam-gyro.json');
let currentSettings: userSettings.type = undefined;

let jsonValidator = new json.validator(userSettings.schema, userSettings.modifier);

let server = new UdpServer.UdpServer();
let controller = new SteamController.SteamController().startWatching(true);

server.addController(controller);

// Read user settings
let readUserSettings = (filePath: string) => {
    let doNotSaveFile = true;

    return json.read(filePath, undefined).then((data: userSettings.type) => {
        if (data === undefined) {
            doNotSaveFile = false;
            data = {} as userSettings.type;
        }

        jsonValidator.validate(data);
        if (jsonValidator.errors && jsonValidator.errors.length > 0)
            throw jsonValidator.errors;
        else
            return data;
    }).then((data) => {
        if (validator.isValidIPv4(data.server.address))
            return data;
        else
            throw new Error(`Invalid IPv4 address: ${data.server}.`);
    }).then((data) => {
        currentSettings = data;
        return data;
    }).then((data) => {
        if (doNotSaveFile)
            return data;
        else
            return json.write(filePath, data).then(() => data);
    });
}

// Start, restart server
let startServer = (settings?: { userSettings?: userSettings.type, userSettingsFilePath?: string }) => {
    return Promise.resolve().then(() => {
        return _.get(settings, 'userSettings') || readUserSettings(_.get(settings, 'userSettingsFilePath') || defaultUserSettingsFile);
    }).then((data) => {
        return new Promise<{ address: string, port: number }>((resolve, reject) => {
            try {
                server.start(data.server.port, data.server.address, () => {
                    controller.setPostScalers(data.postScalers);
                    resolve(data.server);
                });
            } catch (error) {
                reject(error);
            }
        });
    }).then((data) => {
        tray.displayBalloon({ title: 'UDP server started', content: `Running@${data.address}:${data.port}`, icon: iconPng });

        tray.setToolTip(`Server@${data.address}:${data.port}`);
    }).catch((error) => {
        winston.error('FATAL ERROR!');
        winston.error(error);
        exitApp(error);
    });
};

// Exit app and show error window if needed
let exitApp = (error?: any) => {
    isClosing = true;

    server.stop();
    server.removeController();
    controller.stopWatching().close();

    if (rendererWindow !== null)
        rendererWindow.close();

    if (error != undefined && !_.get(currentSettings, 'silentErrors', false)) {
        try {
            if (error instanceof Error)
                error = `Error: ${error.message}`;
            else if (typeof error !== 'string')
                error = JSON.stringify(error, null, 4);

            dialog.showMessageBox(null, { type: 'error', title: 'Steam Gyro encountered a fatal error!', message: 'Error! See error log for details.', icon: iconPng, detail: error });
        } catch (error) {
            dialog.showMessageBox(null, { type: 'error', title: 'Steam Gyro encountered a fatal error!', message: 'Error! See error log for details.', icon: iconPng });
        }
    }

    app.quit();
}

// Creates and/or shows renderer window
let showRendererWindow = () => {
    if (rendererWindow === null) {
        rendererWindow = new BrowserWindow({
            minWidth: 920,
            minHeight: 600,
            width: 920,
            height: 600,
            show: false,
            frame: false,
            backgroundColor: '#303030',
            webPreferences: {
                devTools: process.env.NODE_ENV !== 'production'
            }
        });

        // Load web based interface
        rendererWindow.loadURL(url.format({
            pathname: path.join(__dirname, 'renderer', 'index.html'),
            protocol: 'file:',
            slashes: true
        }));

        // Prevent url opening in renderer itself. Use default browser instead
        rendererWindow.webContents.on('will-navigate', (event, url) => {
            event.preventDefault();
            shell.openExternal(url);
        });

        // Hide window instead of closing it
        rendererWindow.on('close', (event: Event) => {
            if (!isClosing) {
                if (freeBrowserMemoryTimer === undefined) {
                    freeBrowserMemoryTimer = global.setTimeout(() => rendererWindow.close(), 5000);
                    event.preventDefault();
                    rendererWindow.hide();
                    return;
                }
            }

            if (freeBrowserMemoryTimer !== undefined) {
                clearTimeout(freeBrowserMemoryTimer);
                freeBrowserMemoryTimer = undefined;
            }
        });

        rendererWindow.on('closed', () => {
            rendererWindow = null;
        });

        ipcMain.once('angular-loaded', () => {
            rendererWindow.show();
        });
    }
    else if (!rendererWindow.isVisible()) {
        if (freeBrowserMemoryTimer !== undefined) {
            clearTimeout(freeBrowserMemoryTimer);
            freeBrowserMemoryTimer = undefined;
        }

        rendererWindow.show()
    }
}

// Check if this app is already running and quit if it is
const isSecondInstance = app.makeSingleInstance(() => { });
if (isSecondInstance) {
    app.quit();
}

// Add filepath to winston logger
winston.add(winston.transports.File, { filename: path.join(userDataDir, 'steam-gyro-errors.log'), prettyPrint: true, json: false });

// Add necessary events
server.on('error', (data) => {
    if (data.fatal)
        winston.error('FATAL ERROR!');
    winston.error(data.error as any);
    if (data.fatal)
        exitApp(data.error);
});

// Start app
app.on('ready', () => {
    tray = new Tray(icon);
    contextMenu = Menu.buildFromTemplate([
        {
            type: 'normal',
            label: 'Steam Gyro For Cemuhook',
            enabled: false
        },
        {
            type: 'separator'
        },
        {
            type: 'normal',
            label: 'Restart server',
            click: () => startServer()
        },
        {
            type: 'normal',
            label: 'Exit',
            click: () => exitApp()
        }
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('click', () => showRendererWindow());

    startServer();
});

// Required for MacOS
app.on('activate', showRendererWindow);

// Prevent app exit upon renderer window close
app.on('window-all-closed', (event: Event) => {
    event.preventDefault()
});

// Inter-process communication

ipcMain.on('restartServer', (event: { preventDefault: () => void; sender: WebContents; }) => {
    startServer({ userSettings: currentSettings });
});

ipcMain.on('userSettingsReq', (event: { preventDefault: () => void; sender: WebContents; }) => {
    event.sender.send('userSettingsResp', currentSettings);
});

ipcMain.on('saveSettingsReq', (event: { preventDefault: () => void; sender: WebContents; }, data: userSettings.type) => {
    currentSettings = data;
    json.write(defaultUserSettingsFile, currentSettings).then().catch((error) => {
        winston.error('FATAL ERROR!');
        winston.error(error);
        exitApp(error);
    });
});

ipcMain.on('updateGyroReq', (event: { preventDefault: () => void; sender: WebContents; }, data: { x: number, y: number, z: number }) => {
    currentSettings.postScalers.gyro = data;
    controller.setPostScalers({ gyro: data });
});

ipcMain.on('updateAccelerometerReq', (event: { preventDefault: () => void; sender: WebContents; }, data: { x: number, y: number, z: number }) => {
    currentSettings.postScalers.accelerometer = data;
    controller.setPostScalers({ accelerometer: data });
});

ipcMain.on('updateServerReq', (event: { preventDefault: () => void; sender: WebContents; }, data: { address: string, port: number }) => {
    currentSettings.server = data;
});

ipcMain.on('updateErrorSettingsReq', (event: { preventDefault: () => void; sender: WebContents; }, silentErrors: boolean) => {
    currentSettings.silentErrors = silentErrors;
});

ipcMain.on('steamDevicesReq', (event: { preventDefault: () => void; sender: WebContents; }) => {
    event.sender.send('steamDevicesResp', SteamDevice.SteamDevice.getItems(true).concat(SteamDevice.SteamDevice.getExcludedItems()));
});

ipcMain.on('deviceCloseReq', (event: { preventDefault: () => void; sender: WebContents; }) => {
    controller.close();
    event.sender.send('deviceChanged', SteamDevice.SteamDevice.getItems(true).concat(SteamDevice.SteamDevice.getExcludedItems()));
});

ipcMain.on('deviceOpenReq', (event: { preventDefault: () => void; sender: WebContents; }, devicePath: string) => {
    controller.open({ activeOnly: false, autoClose: true, devicePath });
    event.sender.send('deviceChanged', SteamDevice.SteamDevice.getItems(true).concat(SteamDevice.SteamDevice.getExcludedItems()));
});

let dataStreamCallback = (data: SteamController.Report) => {
    rendererWindow.webContents.send('dataStream', data);
}

ipcMain.on('dataStreamStartReq', (event: { preventDefault: () => void; sender: WebContents; }) => {
    if (controller.listeners('SC_ReportByRef').length === 0)
        controller.on('SC_ReportByRef', dataStreamCallback);
});

ipcMain.on('dataStreamStopReq', (event: { preventDefault: () => void; sender: WebContents; }) => {
    controller.removeListener('SC_ReportByRef', dataStreamCallback);
});