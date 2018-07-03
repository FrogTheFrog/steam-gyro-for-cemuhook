import { FilterType } from "./filter-type.interface";

export interface UserSettings {
    server: {
        address: string,
        port: number,
    };
    enabledFilters: {
        gyro: boolean,
        accelerometer: boolean,
    };
    filters: {
        gyro: FilterType[],
        accelerometer: FilterType[],
    };
}
