import { Injectable } from "@angular/core";
import { IpcRendererManager } from "../../../lib/helpers/ipc/renderer";
import { IpcMainEvents } from "../../../models/interface/ipc-main-events.interface";
import { IpcRendererEvents } from "../../../models/interface/ipc-renderer-events.interface";

@Injectable()
export class IpcService extends IpcRendererManager<IpcRendererEvents, IpcMainEvents> {
}
