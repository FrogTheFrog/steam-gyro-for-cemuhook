import { DualshockBattery } from "../enum/dualshock-battery.enum";
import { DualshockConnection } from "../enum/dualshock-connection.enum";
import { DualshockModel } from "../enum/dualshock-model.enum";
import { DualshockState } from "../enum/dualshock-state.enum";

export interface DualshockMeta {
    padId: number;
    state: DualshockState;
    connectionType: DualshockConnection;
    model: DualshockModel;
    macAddress: string;
    batteryStatus: DualshockBattery;
    isActive: boolean;
}
