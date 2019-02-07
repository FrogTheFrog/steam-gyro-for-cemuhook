import {
    EventEmitterLike,
    ListenerCallbackData,
    ListenerRemoveCallback,
    NotificationCallback,
    SourceReceiver,
    SourceSender,
} from "../../models";

/**
 * Manages IPC listeners.
 */
export class IpcListeners {
    /**
     * Stores all callback listeners.
     */
    private static callbacks = new Map<string, ListenerCallbackData>();

    /**
     * @param source Event emitter like object that acts a as source.
     */
    constructor(private source: EventEmitterLike) {
    }

    /**
     * Add receiver to specified channel.
     * @param channel Channel to add receiver to.
     * @param callback Receiver callback.
     * @param onRemove Callback to be called on remove.
     * @returns `true` is receiver has been added, `false` if receiver already exist for this channel.
     */
    public addReceiver(channel: string, callback: SourceReceiver<any>, onRemove: ListenerRemoveCallback) {
        const data = this.getChannel(channel);
        if (data.receiver === null) {
            data.receiver = {
                callback,
                onRemove,
            };
            this.updateChannelSubscription(channel);
            return true;
        }
        return false;
    }

    /**
     * Check if channel has a receiver or if there is receiver on any channel.
     * @param channel Channel to check.
     */
    public hasReceiver(channel?: string) {
        if (channel) {
            const data = this.getChannel(channel);
            return data.receiver !== null;
        } else {
            for (const [, data] of IpcListeners.callbacks) {
                if (data.receiver !== null) {
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * Remove receiver from specific channel or all channels.
     * @param channel Specify channel to remove receiver from.
     */
    public removeReceiver(channel?: string) {
        const remove = (ch: string, data: ListenerCallbackData) => {
            if (data.receiver !== null) {
                data.receiver = null;
                this.updateChannelSubscription(ch);
            }
        };

        if (channel) {
            remove(channel, this.getChannel(channel));
        } else {
            for (const [ch, data] of IpcListeners.callbacks) {
                remove(ch, data);
            }
        }

        return this;
    }

    /**
     * Add sender to specified channel.
     * @param channel Channel to add receiver to.
     * @param callback Sender callback.
     * @param onRemove Callback to be called on remove.
     * @returns `true` is sender has been added, `false` if sender with the same reference already exists.
     */
    public addSender(channel: string, callback: SourceSender<any>, onRemove: ListenerRemoveCallback) {
        const data = this.getChannel(channel);
        if (!data.senders.has(callback)) {
            data.senders.set(callback, onRemove);
            this.updateChannelSubscription(channel);
            return true;
        }
        return false;
    }

    /**
     * Check if channel has any or specific sender, or if there is any or specific sender on any channel.
     * @param channel Channel to check.
     * @param callback Callback to check for.
     */
    public hasSender(channel?: string, callback?: SourceSender<any>) {
        if (channel) {
            const data = this.getChannel(channel);
            if (data.senders.size > 0) {
                return callback ? data.senders.has(callback) : true;
            }
        } else {
            for (const [, data] of IpcListeners.callbacks) {
                if (data.senders.size > 0) {
                    if (callback) {
                        if (data.senders.has(callback)) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Remove specific or all sender(-s) from specific channel. Or remove all senders from all channels.
     * @param channel Specify channel to remove sender(-s) from.
     * @param channel Specify sender to remove from channel.
     */
    public removeSender(channel?: string, callback?: SourceSender<any>) {
        const remove = (ch: string, data: ListenerCallbackData, cb?: SourceSender<any>) => {
            let atLeastOneRemoved: boolean = false;
            if (cb) {
                const onRemove = data.senders.get(cb);
                if (onRemove) {
                    atLeastOneRemoved = true;
                    data.senders.delete(cb);
                    onRemove();
                }
            } else {
                atLeastOneRemoved = data.senders.size > 0;
                for (const [sender, onRemove] of data.senders) {
                    data.senders.delete(sender);
                    onRemove();
                }
            }
            if (atLeastOneRemoved) {
                this.updateChannelSubscription(ch);
            }
        };

        if (channel) {
            const data = this.getChannel(channel);
            remove(channel, data, callback);
        } else {
            for (const [ch, data] of IpcListeners.callbacks) {
                remove(ch, data);
            }
        }

        return this;
    }

    /**
     * Add notification to specified channel.
     * @param channel Channel to add notification to.
     * @param callback Notification callback.
     * @param onRemove Callback to be called on remove.
     * @returns `true` is notification has been added, `false` if notification with the same reference already exists.
     */
    public addNotification(
        channel: string,
        callback: NotificationCallback<any, any, any>,
        onRemove: ListenerRemoveCallback,
    ) {
        const data = this.getChannel(channel);
        if (!data.notifications.has(callback)) {
            data.notifications.set(callback, onRemove);
            return true;
        }
        return false;
    }

    /**
     * Check if channel has any or specific notification, or if there is any or specific notification on any channel.
     * @param channel Channel to check.
     * @param callback Callback to check for.
     */
    public hasNotification(channel?: string, callback?: NotificationCallback<any, any, any>) {
        if (channel) {
            const data = this.getChannel(channel);
            if (data.notifications.size > 0) {
                return callback ? data.notifications.has(callback) : true;
            }
        } else {
            for (const [, data] of IpcListeners.callbacks) {
                if (data.notifications.size > 0) {
                    if (callback) {
                        if (data.notifications.has(callback)) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Remove specific or all notification(-s) from specific channel. Or remove all notifications from all channels.
     * @param channel Specify channel to remove notification(-s) from.
     * @param channel Specify notification to remove from channel.
     */
    public removeNotification(channel?: string, callback?: NotificationCallback<any, any, any>) {
        const remove = (ch: string, data: ListenerCallbackData, cb?: NotificationCallback<any, any, any>) => {
            if (cb) {
                const onRemove = data.notifications.get(cb);
                if (onRemove) {
                    data.notifications.delete(cb);
                    onRemove();
                }
            } else {
                for (const [notification, onRemove] of data.notifications) {
                    data.notifications.delete(notification);
                    onRemove();
                }
            }
        };

        if (channel) {
            const data = this.getChannel(channel);
            remove(channel, data, callback);
        } else {
            for (const [ch, data] of IpcListeners.callbacks) {
                remove(ch, data);
            }
        }

        return this;
    }

    /**
     * Retrieves channel data from callbacks object and initializes if needed.
     * @param channel Channel to retrieve callbacks to.
     */
    private getChannel(channel: string) {
        let data = IpcListeners.callbacks.get(channel);
        if (!data) {
            const newData: ListenerCallbackData = {
                isListening: false,
                notifications: new Map(),
                receiver: null,
                senders: new Map(),
                sourceCallback: (ev, receivedData) => {
                    if (newData.receiver !== null) {
                        newData.receiver.callback(
                            ev,
                            receivedData,
                            () => this.removeReceiver(channel),
                            newData.notifications,
                        );
                    }
                    for (const [callback] of newData.senders) {
                        callback(ev, receivedData, () => this.removeSender(channel, callback));
                    }
                },
            };
            data = newData;
            IpcListeners.callbacks.set(channel, data);
        }
        return data;
    }

    /**
     * Subscribes to or unsubscribes from source.
     * @param channel Channel to check.
     */
    private updateChannelSubscription(channel: string) {
        const data = this.getChannel(channel);
        if (data.isListening) {
            if (data.receiver === null && data.senders.size === 0) {
                this.source.removeListener(channel, data.sourceCallback);
                data.isListening = false;
            }
        } else {
            if (data.receiver !== null || data.senders.size > 0) {
                this.source.on(channel, data.sourceCallback);
                data.isListening = true;
            }
        }
    }
}
