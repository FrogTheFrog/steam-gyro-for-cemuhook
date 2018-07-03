import { cloneDeep } from "lodash";
import * as microtime from "microtime";
import { FilterDataType } from "../models/interface/filter-data-type.interface";
import { FilterData } from "../models/interface/filter-data.interface";
import { FilterType } from "../models/interface/filter-type.interface";
import { GenericFilterFunction } from "../models/type/generic-filter-function.type";

export class Filter {
    public static get availableFilters() {
        return ["None", "Hysteresis", "Low-pass"] as Array<FilterType["type"]>;
    }

    private dataFields: Array<keyof FilterDataType> = ["x", "y", "z"];
    private input: FilterDataType | null = null;
    private output: FilterDataType | null = null;
    private filters: Array<{ fn: GenericFilterFunction } & FilterType> = [];

    public setInputObject(input: FilterDataType) {
        this.input = input;
        return this;
    }

    public setOutputObject(output: FilterDataType) {
        this.output = output;
        return this;
    }

    public addFilter(data: FilterType | FilterType[]) {
        if (data instanceof Array) {
            for (const item of data) {
                this.filters.push(this.generateFilter(this.filters.length, item));
            }
        }
        else {
            this.filters.push(this.generateFilter(this.filters.length, data));
        }

        return this;
    }

    public editFilterType(index: number, type: FilterType["type"]) {
        this.filters[index].fn = this.generateFilterFn(index, type);
        return this;
    }

    public editFilterData(index: number, data: FilterData) {
        Object.assign(this.filters[index], data);
        return this;
    }

    public removeFilter(index?: number) {
        if (index !== undefined) {
            this.filters.splice(index, 1);
        }
        else {
            this.filters = [];
        }

        return this;
    }

    public filter(filterTime?: number, deviationData?: { input: FilterDataType, output: FilterDataType }) {
        // const emitValues: boolean = false;
        const deviations: number[] = new Array(this.dataFields.length);
        const mustBeFiltered: boolean[] = new Array(this.dataFields.length);
        const input = this.input;
        const output = this.output;
        let atLeastOneMustBeFiltered: boolean = false;

        if (input === null || output === null){
            throw new Error("filter output and/or input is not set");
        }

        if (filterTime === undefined) {
            filterTime = microtime.now();
        }

        if (deviationData !== undefined) {
            deviationData = cloneDeep(deviationData);
        }

        for (const filter of this.filters) {
            atLeastOneMustBeFiltered = false;

            for (let j = 0; j < this.dataFields.length; j++) {
                if (filter.deviation.useProvidedData && deviationData !== undefined) {
                    deviations[j] = Math.abs(
                        deviationData.input[this.dataFields[j]] - deviationData.output[this.dataFields[j]],
                    );
                }
                else {
                    deviations[j] = Math.abs(
                        input[this.dataFields[j]] - output[this.dataFields[j]],
                    );
                }

                mustBeFiltered[j] = filter.deviation.min <= deviations[j] && deviations[j] <= filter.deviation.max;
                if (mustBeFiltered[j]) {
                    atLeastOneMustBeFiltered = true;
                }
            }

            if (atLeastOneMustBeFiltered) {
                if (filter.filterAllAtOnce) {
                    for (let j = 0; j < this.dataFields.length; j++) {
                        filter.fn(this.dataFields[j], deviations[j], filterTime, deviationData);
                    }
                }
                else {
                    for (let j = 0; j < this.dataFields.length; j++) {
                        if (mustBeFiltered[j]) {
                            filter.fn(this.dataFields[j], deviations[j], filterTime, deviationData);
                        }
                        else {
                            output[this.dataFields[j]] = input[this.dataFields[j]];
                        }
                    }
                }
            }
            else {
                for (const field of this.dataFields) {
                    output[field] = input[field];
                }
            }

            /* if (emitValues) {

            } */
        }

        return this;
    }

    private generateFilterFn(index: number, type: FilterType["type"]) {
        const filter = this.filters[index];
        const input = this.input as FilterDataType;
        const output = this.output as FilterDataType;

        switch (type) {
            case "Low-pass":
                return (field: keyof FilterDataType, deviationModulus: number, time: number) => {
                    output[field] = output[field] + filter.coefficients[0] * (input[field] - output[field]);
                };
            case "Hysteresis": {
                let oldTime: number | null = null;
                return (field: keyof FilterDataType, deviationModulus: number, time: number) => {
                    if (oldTime === null && deviationModulus > filter.coefficients[0]) {
                        oldTime = time;
                    }

                    if (oldTime !== null) {
                        if (time - oldTime < filter.coefficients[1]) {
                            output[field] = input[field];
                        }
                        else {
                            oldTime = null;
                        }
                    }
                };
            }
            case "None":
                return (field: keyof FilterDataType) => { output[field] = input[field]; };
            default:
                throw new Error("Invalid filter type");
        }
    }

    private generateFilter(index: number, data: FilterType) {
        return Object.assign({ fn: this.generateFilterFn(index, data.type) }, data);
    }
}
