import { InjectionToken } from "@angular/core";
import { MessageObject } from "../../../shared/models";

/**
 * Custom injection token for message object.
 */
export const MESSAGE_OBJECT_DATA = new InjectionToken<MessageObject["data"]>("MESSAGE_OBJECT_DATA");
