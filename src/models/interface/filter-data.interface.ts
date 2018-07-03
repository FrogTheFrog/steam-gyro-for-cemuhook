export interface FilterData {
    deviation: {
        min: number,
        max: number,
        useProvidedData: boolean,
    };
    coefficients: number[];
    filterAllAtOnce: boolean;
}
