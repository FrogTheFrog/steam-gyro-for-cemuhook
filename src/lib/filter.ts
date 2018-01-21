import { TypedEventEmitter } from "./typed-event-emitter";
import * as _ from "lodash";
import * as microtime from "microtime";

export namespace Filter {
    export interface Type extends FilterData {
        type: FilterType
    }

    export type FilterType = 'None' | 'Hysteresis' | 'Low-pass';

    export interface FilterData {
        filterAllAtOnce: boolean,
        deviation: {
            min: number,
            max: number,
            useProvidedData: boolean
        },
        coefficients: number[]
    }

    export interface DataType {
        x: number,
        y: number,
        z: number
    }

    export interface Events {
        values: { type: Type['type'], index: number, data: DataType };
    }

    type filterFn = (field: string, deviationModulus: number, time: number, deviationData: { input: DataType, output: DataType }) => void;

    export function getAvailableFilters() {
        return <FilterType[]>['None', 'Hysteresis', 'Low-pass'];
    }

    export class Manager extends TypedEventEmitter<Events> {
        private dataFields = ['x', 'y', 'z'];
        private input: DataType = undefined;
        private output: DataType = undefined;
        private filters: ({ fn: filterFn } & Type)[] = [];

        setInputObject(input: DataType) {
            this.input = input;
            return this;
        }

        setOutputObject(output: DataType) {
            this.output = output;
            return this;
        }

        addFilter(data: Type | Type[]) {
            if (data instanceof Array) {
                for (let i = 0; i < data.length; i++)
                    this.filters.push(this.generateFilter(this.filters.length, data[i]));
            }
            else
                this.filters.push(this.generateFilter(this.filters.length, data));

            return this;
        }

        editFilterType(index: number, type: FilterType) {
            this.filters[index].fn = this.generateFilterFn(index, type);
            return this;
        }

        editFilterData(index: number, data: FilterData) {
            Object.assign(this.filters[index], data);
            return this;
        }

        removeFilter(index?: number) {
            if (index === undefined)
                this.filters.splice(index, 1);
            else
                this.filters = [];

            return this;
        }

        filter(filterTime?: number, deviationData?: { input: DataType, output: DataType }) {
            let emitValues: boolean = false;
            let atLeastOneMustBeFiltered: boolean = false;
            let deviations: number[] = new Array(this.dataFields.length);
            let mustBeFiltered: boolean[] = new Array(this.dataFields.length);

            if (filterTime === undefined)
                filterTime = microtime.now();

            if (deviationData !== undefined)
                deviationData = _.cloneDeep(deviationData);

            for (let i = 0; i < this.filters.length; i++) {
                atLeastOneMustBeFiltered = false;

                for (let j = 0; j < this.dataFields.length; j++) {
                    if (this.filters[i].deviation.useProvidedData && deviationData !== undefined)
                        deviations[j] = Math.abs(deviationData.input[this.dataFields[j]] - deviationData.output[this.dataFields[j]]);
                    else
                        deviations[j] = Math.abs(this.input[this.dataFields[j]] - this.output[this.dataFields[j]]);

                    mustBeFiltered[j] = this.filters[i].deviation.min <= deviations[j] && deviations[j] <= this.filters[i].deviation.max;
                    if (mustBeFiltered[j])
                        atLeastOneMustBeFiltered = true;
                }

                if (atLeastOneMustBeFiltered) {
                    if (this.filters[i].filterAllAtOnce) {
                        for (let j = 0; j < this.dataFields.length; j++)
                            this.filters[i].fn(this.dataFields[j], deviations[j], filterTime, deviationData);
                    }
                    else {
                        for (let j = 0; j < this.dataFields.length; j++) {
                            if (mustBeFiltered[j])
                                this.filters[i].fn(this.dataFields[j], deviations[j], filterTime, deviationData);
                            else
                                this.output[this.dataFields[j]] = this.input[this.dataFields[j]];
                        }
                    }
                }
                else {
                    for (let j = 0; j < this.dataFields.length; j++)
                        this.output[this.dataFields[j]] = this.input[this.dataFields[j]];
                }

                if (emitValues) {

                }
            }

            return this;
        }

        private generateFilterFn(index: number, type: FilterType) {
            switch (type) {
                case 'Low-pass':
                    return (field: string, deviationModulus: number, time: number, deviationData: { input: DataType, output: DataType }) => {
                        this.output[field] = this.output[field] + this.filters[index].coefficients[0] * (this.input[field] - this.output[field]);
                    };
                case 'Hysteresis': {
                    let self = this;
                    return function (field: string, deviationModulus: number, time: number, deviationData: { input: DataType, output: DataType }) {
                        if (this.oldTime === undefined && deviationModulus > self.filters[index].coefficients[0])
                            this.oldTime = time;

                        if (time - this.oldTime < self.filters[index].coefficients[1])
                            self.output[field] = self.input[field];
                        else
                            this.oldTime = undefined;
                    };
                }
                case 'None':
                    return (field: string, deviationModulus: number, time: number, deviationData: { input: DataType, output: DataType }) => { this.output[field] = this.input[field] };
                default:
                    throw new Error('Invalid filter type');
            }
        }

        private generateFilter(index: number, data: Type) {
            return Object.assign({ fn: this.generateFilterFn(index, data.type) }, data);
        }
    }
}