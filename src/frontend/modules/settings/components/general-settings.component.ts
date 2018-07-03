import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, AbstractControl, Validators } from "@angular/forms";

@Component({
    selector: "general-settings",
    templateUrl: "../templates/general-settings.template.html",
})
export class GeneralSettings implements OnInit {
    private form!: FormGroup;

    constructor(private fb: FormBuilder) {
    }

    public ngOnInit() {
        this.form = this.fb.group({
            server: this.fb.group({
                address: [null,
                    [
                        Validators.required, (control: AbstractControl) => {
                            return !this.isValidIPv4(control.value) ? { invalidAddress: true } : null;
                        },
                    ],
                ],
                port: [null, [this.patternValidator(/^\d*$/, "Invalid port"), Validators.required]],
            }),
            // tslint:disable-next-line:object-literal-sort-keys
            enabledFilters: this.fb.group({
                gyro: [null],
                // tslint:disable-next-line:object-literal-sort-keys
                accelerometer: [null],
            }),
        });
    }

    private patternValidator(pattern: RegExp, error: string) {
        return (control: AbstractControl) => {
            return !pattern.test(control.value) ? { invalidPattern: error } : null;
        };
    }

    private isValidIPv4(value: string) {
        return /^(?=\d+\.\d+\.\d+\.\d+$)(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.?){4}$/.test(value);
    }

    private hasErrors(controlPath: string) {
        return this.form.get(controlPath)!.errors !== null;
    }

    private getErrorMsg(controlPath: string) {
        const control = this.form.get(controlPath)!;

        if (control.errors!.invalidPattern) {
            return control.errors!.invalidPattern;
        }
        else if (control.errors!.required) {
            return "Input is required";
        }
        else if (control.errors!.invalidAddress) {
            return "Invalid IPv4 address";
        }
    }
}
