import { TypedFilterData, MotionDataWithTimestamp } from "../../controller-api";
import { MethodicalEvents } from "./ipc.models";
import { MessageObject } from "./message.models";
import { UserSettings } from "./user-settings.models";

/**
 * IPC events in the following order: [fromMain, toMain]
 */
export interface IpcEvents extends MethodicalEvents {
    GET: {
        "settings:server": [UserSettings["server"], void];
        "settings:filter": [UserSettings["filter"], void];
        "messages": [MessageObject[], void];
    };
    PUT: {
        "settings:server:address": [void, string];
        "settings:server:port": [void, number];
        "settings:filter": [void, TypedFilterData];
        "device-status": [boolean, void];
        "data-stream": [object, void];
        "connection-status": [boolean, void];
    };
    POST: {
        "restart-server": [void, void];
        "device-status": [void, boolean];
        "data-stream": [void, boolean];
        "connection-status": [void, boolean];
        "motion-data-stream": [[MotionDataWithTimestamp, void], [boolean, void]];
        "message": [[{ display: boolean, message: MessageObject }, void], [MessageObject, void]];
    };
}
