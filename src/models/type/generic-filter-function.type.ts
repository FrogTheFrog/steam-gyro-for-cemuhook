import { FilterDataType } from "../interface/filter-data-type.interface";

export type GenericFilterFunction = (
    field: keyof FilterDataType,
    deviationModulus: number,
    time: number,
    deviationData?: {
        input: FilterDataType,
        output: FilterDataType,
    }
) => void;
