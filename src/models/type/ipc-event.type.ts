import { IpcResponse } from "./ipc-response.type";

export type IpcEvent<Receive extends object, Send extends object, V = {
    [K in keyof Receive]: {
        event: K,
        value: Receive[K],
        response: IpcResponse<Send>,
    }
}> = V[keyof V];
