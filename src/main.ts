import { app, Menu, Tray, dialog, nativeImage } from 'electron';
import { UdpServer } from './lib/udp-server';
import { SteamController } from "./lib/steam-controller";
import { readJson, writeJson } from "./lib/json-helpers";
import * as Ajv from 'ajv';
import * as winston from "winston";
import * as fs from 'fs-extra';
import * as path from 'path';

interface userSettings {
    server: string,
    port: number,
    silentErrors: boolean,
    useAddressIfUsedByOtherProcess: boolean,
    postScalers: {
        gyro: {
            x: number,
            y: number,
            z: number
        }, accelerometer: {
            x: number,
            y: number,
            z: number
        }
    }
}

let tray: Tray = null;
let contextMenu: Menu = null;
let userDataDir: string = process.env.PORTABLE_EXECUTABLE_DIR || '';
let icon: nativeImage = nativeImage.createFromPath(path.join(__dirname, require('../assets/icon.ico')));
let iconPng: nativeImage = nativeImage.createFromBuffer(icon.toPNG());
let server = new UdpServer.Interface();
let controller = new SteamController.Interface();
let ajv = new Ajv({ removeAdditional: 'all', useDefaults: true });
let validationFn = ajv.compile(require('./lib/settings.schema.json'));
let silentErrors = false;

// Start, restart server
let startServer = () => {
    let userSettingsFile = path.join(userDataDir, 'steam-gyro.json');
    readJson(userSettingsFile, {}).then((data: userSettings) => {
        validationFn(data);
        if (validationFn.errors && validationFn.errors.length > 0)
            throw validationFn.errors;
        else
            return data;
    }).then((data) => {
        if (/^(?=\d+\.\d+\.\d+\.\d+$)(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.?){4}$/.test(data.server))
            return data;
        else
            throw new Error(`Invalid IPv4 address: ${data.server}.`);
    }).then((data) => {
        silentErrors = data.silentErrors;
        return data;
    }).then((data) => {
        return writeJson(userSettingsFile, data).then(() => data);
    }).then((data) => {
        if (!controller.connect())
            throw new Error('failed to connect to Steam Controller (not found, make sure it is enabled)');

        return new Promise<{ server: string, port: number }>((resolve, reject) => {
            try {
                server.start(data.port, data.server, () => {
                    controller.setPostScalers(data.postScalers);
                    server.removeController();
                    server.addController(controller);
                    resolve(data);
                });
            } catch (error) {
                reject(error);
            }
        });
    }).then((data) => {
        tray.displayBalloon({ title: 'UDP server started', content: `Running@${data.server}:${data.port}`, icon: iconPng });
        tray.setToolTip(`Server@${data.server}:${data.port}`);
    }).catch((error) => {
        winston.error('FATAL ERROR!');
        winston.error(error);
        exitApp(error);
    });
};

// Exit app and show error window if needed
let exitApp = (error?: any) => {
    server.stop();
    server.removeController();
    controller.disconnect();

    if (error != undefined && !silentErrors) {
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

// Check if this app is already running and quit if it is
const isSecondInstance = app.makeSingleInstance(() => { });
if (isSecondInstance) {
    app.quit();
}

// Add filepath to winston logger
winston.add(winston.transports.File, { filename: path.join(userDataDir, 'steam-gyro-errors.log'), prettyPrint: true, json: false });

// Add necessary events
server.addEventListener('error', (event: string, error: any, fatal: boolean) => {
    if (fatal)
        winston.error('FATAL ERROR!');
    winston.error(error);
    if (fatal)
        exitApp(error);
});

// Start app
app.on('ready', () => {
    tray = new Tray(icon);
    contextMenu = Menu.buildFromTemplate([
        {
            type: 'normal',
            enabled: false,
            label: 'Steam Gyro For Cemuhook'
        },
        { type: 'separator' },
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
    startServer();
});