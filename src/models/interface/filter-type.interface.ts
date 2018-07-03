import { FilterData } from "./filter-data.interface";

export interface FilterType extends FilterData {
    type: "None" | "Hysteresis" | "Low-pass";
}
