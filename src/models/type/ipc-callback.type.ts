import { IpcResponse } from "./ipc-response.type";

export type IpcCallback<Receive extends object, Send extends object, Event extends Extract<keyof Receive, string>> =
    (data: Receive[Event], response: IpcResponse<Send>) => void;
