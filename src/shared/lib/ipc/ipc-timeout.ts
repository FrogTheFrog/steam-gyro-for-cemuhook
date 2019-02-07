/**
 * IPC Timeout handler.
 */
export class IpcTimeout {
    /**
     * Specifies whether timeout has occurred or not.
     */
    public timedOut: boolean = false;

    /**
     * Reference to timeout instance.
     */
    private timeout: NodeJS.Timeout | null = null;

    /**
     * @param onTimeout Global callback to be called on any timeout.
     */
    constructor(public onTimeout?: () => void) {
    }

    /**
     * Clears timeout.
     */
    public clear() {
        if (this.timeout !== null) {
            clearTimeout(this.timeout);
            this.timeout = null;
            this.timedOut = false;
        }
    }

    /**
     * (Re-)sets timeout.
     * @param value Time in milliseconds to timeout.
     * @param onTimeout Additional timeout callback to be called for this specific timeout.
     */
    public update(value: number, onTimeout?: () => void) {
        this.clear();
        this.timeout = setTimeout(() => {
            this.timeout = null;
            this.timedOut = true;
            if (typeof onTimeout === "function") {
                onTimeout();
            }
            if (typeof this.onTimeout === "function") {
                this.onTimeout();
            }
        }, value);
    }
}
