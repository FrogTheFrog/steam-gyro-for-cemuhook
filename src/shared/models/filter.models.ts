/**
 * Array of available filters.
 */
export const availableFilters: ["disabled", "low-high-pass"]
    = ["disabled", "low-high-pass"];

/**
 * Available filters.
 */
export type AvailableFilters = (typeof availableFilters)[number];

/**
 * Object implementing available filters.
 */
export type AvailableFiltersObject = {
    [T in AvailableFilters]: number[]
};

/**
 * Filter data object.
 */
export interface FilterData extends AvailableFiltersObject {
    "disabled": [];
    "low-high-pass": [number, number];
}

/**
 * Separated filter data object.
 */
export type TypedFilterData<V = {
    [T in keyof FilterData]: {
        type: T,
        value: FilterData[T],
    }
}> = V[keyof V];
