export class EventListener {
    protected listeners = new Map<string, ((event: string, ...data: any[]) => void)[]>();

    addEventListener(event: string, callback: (event: string, ...data: any[]) => void) {
        if (this.listeners.has(event)) {
            let eventListeners = this.listeners.get(event);
            if (eventListeners.indexOf(callback) === -1)
                eventListeners.push(callback);
        }
        else {
            this.listeners.set(event, [callback]);
        }
    }

    removeEventListener(event: string, callback: (event: string, ...data: any[]) => void) {
        if (this.listeners.has(event)) {
            let eventListeners = this.listeners.get(event);
            let index = eventListeners.indexOf(callback);
            if (index !== -1)
                eventListeners.splice(index, 1);
        }
    }

    removeAllListeners(callback: (event: string, ...data: any[]) => void) {
        let entries = this.listeners.entries();
        for (let [key, value] of entries) {
            let index = value.indexOf(callback);
            if (index !== -1)
                value.splice(index, 1);
        }
    }

    hasListeners(event: string){
        return this.listeners.has(event) && this.listeners.get(event).length > 0;
    }

    protected dispatchEvent(event: string, ...data: any[]) {
        if (this.listeners.has(event)) {
            let eventListeners = this.listeners.get(event);
            if (eventListeners.length > 0)
                eventListeners.forEach(listener => listener(event, ...data));
        }
    }
}