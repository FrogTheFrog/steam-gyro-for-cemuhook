import { Component, OnDestroy, OnInit } from "@angular/core";
import {
    AbstractControl,
    FormArray,
    FormBuilder,
    FormControl,
    FormGroup,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from "@angular/forms";
import { combineLatest, Subscription } from "rxjs";
import { debounceTime, distinctUntilChanged, filter, map, share, tap } from "rxjs/operators";
import { AvailableFilters, FilterData, TypedFilterData } from "../../../../controller-api";
import { MessageLogService } from "../../message-log/message-log.service";
import { SettingsService } from "../settings.service";

type TupleLength<T extends any[]> = T extends { length: infer Length } ? Length : never;
type Tuple<T, Length extends number> = Length extends 0 ? [] : [T, ...T[]] & { length: Length };

type Filters = {
    [key in keyof FilterData]: {
        inputStep: Tuple<number | null, TupleLength<FilterData[key]>>,
        names: Tuple<string, TupleLength<FilterData[key]>>,
        selectName: string,
        validators: Tuple<ValidatorFn[], TupleLength<FilterData[key]>>,
        value: FilterData[key],
    };
};

/**
 * Handles filter settings.
 */
@Component({
    selector: "filter-settings",
    styleUrls: ["./filter.style.scss"],
    templateUrl: "./filter.template.html",
})
export class FilterComponent implements OnInit, OnDestroy {
    /**
     * Filter data.
     */
    public filterData: Filters = {
        "disabled": {
            inputStep: [],
            names: [],
            selectName: "Disabled",
            validators: [],
            value: [],
        },
        "low-high-pass": {
            inputStep: [0.01, 0.01],
            names: ["Accelerometer's time constant", "Gyro's time constant"],
            selectName: "Low-pass/High-pass",
            validators: [[
                Validators.required, this.positiveInputValidator,
            ], [
                Validators.required, this.positiveInputValidator,
            ]],
            value: [0, 0],
        },
    };

    /**
     * Form group for filter.
     */
    public filterForm!: FormGroup;

    /**
     * Various subscriptions for cleanup.
     */
    private subscriptions!: Subscription;

    constructor(
        private settingsService: SettingsService,
        private messageService: MessageLogService,
        private fb: FormBuilder,
    ) {
    }

    /**
     * Initialize observables and etc.
     */
    public ngOnInit() {
        this.filterForm = this.fb.group({
            filter: this.fb.group({
                enabled: [null],
                parameters: this.fb.array([]),
                type: [null],
            }),
        });

        const dataStream = this.dataStreamObservable();

        this.subscriptions = dataStream.pipe(
            tap((data) => {
                this.filterData[data.type].value = data.value;
                this.settingsService.graphData.filter.setFilter(data);
                if (!this.settingsService.dataIsStreaming.value) {
                    this.settingsService.graphData.recalculateFilteredData();
                }
            }),
            debounceTime(500),
        ).subscribe((data) => {
            this.settingsService.setFilterData(data)
                .catch(this.messageService.errorHandler);
        });

        this.settingsService.getFilterSettings()
            .then((filterData) => {
                const { data, type } = filterData;
                for (const key in data) {
                    if (data.hasOwnProperty(key)) {
                        this.filterData[key as keyof FilterData].value = data[key as keyof FilterData];
                    }
                }
                this.parameters.patchValue(data[type]);
                this.type.setValue(type);
            }).catch(this.messageService.errorHandler);
    }

    /**
     * Generates data stream observable.
     */
    public dataStreamObservable() {
        return combineLatest(
            this.type.valueChanges.pipe(
                map((value: AvailableFilters) => {
                    if (this.type.valid) {
                        this.deleteFormFields();
                        this.createInputFields(value);
                        return value;
                    } else {
                        return false;
                    }
                }),
            ),
            this.parameters.valueChanges.pipe(
                map((values: number[]) => {
                    return this.parameters.valid ? values : false;
                }),
                distinctUntilChanged((a, b) => {
                    return JSON.stringify(a) === JSON.stringify(b);
                }),
            ),
        ).pipe(
            filter(([type, value]) => {
                if (type !== false && value !== false) {
                    return this.filterData[type].value.length === value.length;
                } else {
                    return false;
                }
            }),
            map(([type, value]) => {
                return { type, value } as TypedFilterData;
            }),
            share(),
        );
    }

    /**
     * Cleanup.
     */
    public ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }

    /**
     * Getter for parameters field.
     */
    public get parameters(){
        return this.filterForm.get("filter.parameters")! as FormArray;
    }

    /**
     * Getter for type field.
     */
    public get type(){
        return this.filterForm.get("filter.type")! as FormControl;
    }

    /**
     * Getter for filter data.
     */
    public get selectedFilterData(){
        return this.filterData[this.type.value as keyof FilterData];
    }

    /**
     * Toggle data stream.
     */
    public toggleStream() {
        if (this.settingsService.dataIsStreaming.value) {
            this.settingsService.stopMotionDataStream();
        } else {
            this.settingsService.startMotionDataStream();
        }
    }

    /**
     * Creates input fields for filter parameters.
     */
    private createInputFields(type: AvailableFilters) {
        const parametersField = this.filterForm.get("filter.parameters") as FormArray;
        if (parametersField) {
            if (typeof this.filterData[type] === "object") {
                const { value, validators } = this.filterData[type];
                if (value.length === validators.length) {
                    for (let i = 0; i < value.length; i++) {
                        parametersField.push(this.fb.control(value[i], validators[i]));
                    }
                } else {
                    throw new Error("Incorrect filter data interface.");
                }
            } else {
                throw new Error("Unsupported filter type.");
            }
        }
    }

    /**
     * Deletes form field from parameters field.
     */
    private deleteFormFields() {
        const parametersField = this.filterForm.get("filter.parameters") as FormArray;
        if (parametersField) {
            while (parametersField.length !== 0) {
                parametersField.removeAt(0);
            }
        }
    }

    /**
     * Validates if control has positive input.
     * @param control Controller to validate.
     */
    private positiveInputValidator(control: AbstractControl): ValidationErrors | null {
        return control.value < 0 ? { negative: true } : null;
    }
}
