import { FilterDataType } from "./filter-data-type.interface";
import { FilterType } from "./filter-type.interface";

export interface FilterEvents {
    values: { type: FilterType["type"], index: number, data: FilterDataType };
}
