import { IpcRenderer, WebContents, EventEmitter } from "electron";

export declare interface TypedWebContents<In, Out = In> {
    addListener<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { sender: TypedIpcRenderer<In, Out> }, arg: In[Ki]) => void): this;
    on<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { sender: TypedIpcRenderer<In, Out> }, arg: In[Ki]) => void): this;
    once<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { sender: TypedIpcRenderer<In, Out> }, arg: In[Ki]) => void): this;
    removeListener<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { sender: TypedIpcRenderer<In, Out> }, arg: In[Ki]) => void): this;
    removeAllListeners<Ki extends keyof In>(channel?: Ki): this;
    send<Ko extends keyof Out>(channel: Ko, arg: Out[Ko]): void;
}

export interface TypedIpcMain<In, Out = In> extends EventEmitter {
    addListener<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { returnValue?: any, sender: TypedWebContents<In, Out> }, arg: In[Ki]) => void): this;
    on<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { returnValue?: any, sender: TypedWebContents<In, Out> }, arg: In[Ki]) => void): this;
    once<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { returnValue?: any, sender: TypedWebContents<In, Out> }, arg: In[Ki]) => void): this;
    removeListener<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { returnValue?: any, sender: TypedWebContents<In, Out> }, arg: In[Ki]) => void): this;
    removeAllListeners<Ki extends keyof In>(channel?: Ki): this;
}

export interface TypedIpcRenderer<In, Out = In> extends EventEmitter {
    addListener<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { sender: TypedIpcRenderer<In, Out> }, arg: In[Ki]) => void): this;
    on<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { sender: TypedIpcRenderer<In, Out> }, arg: In[Ki]) => void): this;
    once<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { sender: TypedIpcRenderer<In, Out> }, arg: In[Ki]) => void): this;
    removeListener<Ki extends keyof In, Ko extends keyof Out>(channel: Ki, listener: (event: { sender: TypedIpcRenderer<In, Out> }, arg: In[Ki]) => void): this;
    removeAllListeners<Ki extends keyof In>(channel?: Ki): this;
    send<Ko extends keyof Out>(channel: Ko, arg: Out[Ko]): void;
    sendSync<Ko extends keyof Out>(channel: Ko, arg: Out[Ko]): any;
    sendToHost<Ko extends keyof Out>(channel: Ko, arg: Out[Ko]): void;
}