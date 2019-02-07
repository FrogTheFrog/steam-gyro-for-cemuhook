/**
 * Message object for error.
 */
export interface ErrorObject {
    type: "error";
    data: Error;
}

/**
 * Message object for information.
 */
export interface InfoObject {
    type: "info";
    data: string;
}

/**
 * Generic message object.
 */
export type MessageObject = ErrorObject | InfoObject;
