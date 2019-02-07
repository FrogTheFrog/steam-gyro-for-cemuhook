import {
    EventEmitterLike,
    UniqueIDGenerator,
} from "../../models/ipc.models";
import { IpcId } from "./ipc-id";
import { IpcListeners } from "./ipc-listeners";

/**
 * Object for sharing data between sender and listener objects.
 */
export class IpcShared {
    /**
     * IPC id manager.
     */
    public id: IpcId;

    /**
     * IPC listener manager.
     */
    public listener: IpcListeners;

    /**
     * @param source Event emitter like object that acts as a source.
     * @param uidGenerator Generator function used to generate ids.
     * @param customChannelGenerator Optional custom channel string generator.
     */
    constructor(
        source: EventEmitterLike,
        uidGenerator: UniqueIDGenerator,
        private customChannelGenerator?: IpcShared["generateChannel"],
    ) {
        this.id = new IpcId(uidGenerator);
        this.listener = new IpcListeners(source);
    }

    /**
     * Generates channel from method and event combination.
     * @param method Method for channel.
     * @param event Event for channel.
     * @returns Generated channel string.
     */
    public generateChannel(method: string, event: string): string {
        return this.customChannelGenerator ? this.customChannelGenerator(method, event) : `[${method}](${event})`;
    }
}
