import { OverlayRef } from "@angular/cdk/overlay";

/**
 * A reference to message overlay.
 */
export class MessageOverlayRef {
    constructor(private overlayRef: OverlayRef) { }

    /**
     * Closes open overlay.
     */
    public close() {
        this.overlayRef.dispose();
    }

    /**
     * Indicates whether overlay is open.
     */
    public isOpen() {
        return this.overlayRef.hasAttached();
    }
}
