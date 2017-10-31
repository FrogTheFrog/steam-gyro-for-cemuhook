import { EventEmitter } from "events";

export declare interface TypedEventEmitter<T> {
    addListener<K extends keyof T>(event: K, listener: (arg: T[K]) => any): this;
    on<K extends keyof T>(event: K, listener: (arg: T[K]) => any): this;
    once<K extends keyof T>(event: K, listener: (arg: T[K]) => any): this;
    removeListener<K extends keyof T>(event: K, listener: (arg: T[K]) => any): this;
    removeAllListeners<K extends keyof T>(event?: K): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners<K extends keyof T>(event: K): ((arg: T[K]) => any)[];
    emit<K extends keyof T>(event: K, arg: T[K]): boolean;
    listenerCount<K extends keyof T>(type: K): number;
    prependListener<K extends keyof T>(event: K, listener: (arg: T[K]) => any): this;
    prependOnceListener<K extends keyof T>(event: K, listener: (arg: T[K]) => any): this;
    eventNames(): (string | symbol)[];
}

export class TypedEventEmitter<T> extends EventEmitter {}