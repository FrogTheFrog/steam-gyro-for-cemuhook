import { MotionData } from "./motion-data.interface";

export interface GenericDeviceEvents {
    "report": object & MotionData;
    "motionData": MotionData;
    "error": Error;
    "close": void;
}
