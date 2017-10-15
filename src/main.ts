import { app, Menu, Tray, dialog, nativeImage } from 'electron';
import { UdpServer } from './udp-server';
import { SteamController } from "./steam-controller";
import { readJson, writeJson } from "./json-helpers";
import * as Ajv from 'ajv';
import * as winston from "winston";
import * as fs from 'fs-extra';
import * as path from 'path';

let tray: Tray = null;
let contextMenu: Menu = null;
let userDataDir: string = process.env.PORTABLE_EXECUTABLE_DIR || '';
let icon: nativeImage = nativeImage.createFromPath(path.join(__dirname, require('../assets/icon.ico')));
let server = new UdpServer.Interface();
let controller = new SteamController.Interface();
let ajv = new Ajv({ removeAdditional: 'all', useDefaults: true });
let validationFn = ajv.compile(require('./settings.schema.json'));

// Start, restart server
let startServer = () => {
    let userSettingsFile = path.join(userDataDir, 'steam-gyro.json');
    readJson(userSettingsFile, { server: '127.0.0.1', port: 26760, melodyOnConnection: 0 }).then((data) => {
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
        return writeJson(userSettingsFile, data).then(() => data);
    }).then((data) => {
        if (!controller.connect())
            throw new Error('failed to connect to Steam Controller (not found, make sure it is enabled)');

        server.start(data.port, data.server);
        server.removeController();
        server.addController(controller);

        tray.setToolTip(`Server@${data.server}:${data.port}`);

        controller.playMelody(data.melodyOnConnection);
    }).catch((error) => {
        winston.error('FATAL ERROR!');
        winston.error(error);
        exitApp(error);
    });
};

// Exit app and show error window if needed
let exitApp = (error?: string) => {
    server.stop();
    server.removeController();
    controller.disconnect();

    if (error != undefined) {
        try {
            dialog.showMessageBox(null, { type: 'error', title: 'Steam Gyro encountered a fatal error!', message: 'Error! See error log for details.', icon, detail: JSON.stringify(error, null, 4) });
        } catch (error) {
            dialog.showMessageBox(null, { type: 'error', title: 'Steam Gyro encountered a fatal error!', message: 'Error! See error log for details.', icon });
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