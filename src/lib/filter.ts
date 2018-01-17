import { TypedEventEmitter } from "./typed-event-emitter";
import * as _ from "lodash";

export namespace Filter {
    export interface Type extends FilterData {
        type: FilterType
    }

    export type FilterType = 'None' | 'Hysteresis' | 'Low-pass';

    export interface FilterData {
        filterAllAtOnce: boolean,
        deviation: {
            min: number,
            max: number
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

    type filterFn = (field: string, deviation: number) => void;

    export function getAvailableFilters() {
        return <FilterType[]> ['None', 'Hysteresis', 'Low-pass'];
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

        filter() {
            let emitValues: boolean = false;
            let atLeastOneMustBeFiltered: boolean = false;
            let deviations: number[] = new Array(this.dataFields.length);
            let mustBeFiltered: boolean[] = new Array(this.dataFields.length);

            for (let i = 0; i < this.filters.length; i++) {
                atLeastOneMustBeFiltered = false;

                for (let j = 0; j < this.dataFields.length; j++) {
                    deviations[j] = this.input[this.dataFields[j]] - this.output[this.dataFields[j]];
                    mustBeFiltered[j] = this.filters[i].deviation.min <= Math.abs(deviations[j]) && Math.abs(deviations[j]) <= this.filters[i].deviation.max;
                    if (mustBeFiltered[j])
                        atLeastOneMustBeFiltered = true;
                }

                if (atLeastOneMustBeFiltered) {
                    if (this.filters[i].filterAllAtOnce) {
                        for (let j = 0; j < this.dataFields.length; j++)
                            this.filters[i].fn(this.dataFields[j], deviations[j]);
                    }
                    else {
                        for (let j = 0; j < this.dataFields.length; j++) {
                            if (mustBeFiltered[j])
                                this.filters[i].fn(this.dataFields[j], deviations[j]);
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
                    return (field: string, deviation: number) => { this.IIR_Filter(field, deviation, this.filters[index].coefficients[0]); };
                case 'Hysteresis':
                    return (field: string, deviation: number) => { };
                case 'None':
                    return (field: string, deviation: number) => { this.output[field] = this.input[field] };
                default:
                    throw new Error('Invalid filter type');
            }
        }

        private generateFilter(index: number, data: Type) {
            return Object.assign({ fn: this.generateFilterFn(index, data.type) }, data);
        }

        private IIR_Filter(field: string, delta: number, alpha: number) {
            this.output[field] = this.output[field] + alpha * delta;
        }
    }
}