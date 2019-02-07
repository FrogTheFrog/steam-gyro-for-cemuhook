import { ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { AbstractControl, FormBuilder, FormGroup, Validators } from "@angular/forms";
import { combineLatest, Observable } from "rxjs";
import { map, mergeMap } from "rxjs/operators";
import { MessageLogService } from "../../message-log/message-log.service";
import { SettingsService } from "../settings.service";

/**
 * Handles server settings form.
 */
@Component({
    selector: "server-settings",
    styleUrls: ["./server.style.scss"],
    templateUrl: "./server.template.html",
})
export class ServerComponent implements OnInit {
    /**
     * Notifies whether server can be restarted or not.
     */
    public canRestart!: Observable<boolean>;

    /**
     * Form group for server.
     */
    public serverForm!: FormGroup;

    constructor(
        private settingsService: SettingsService,
        private messageService: MessageLogService,
        private fb: FormBuilder,
        private changeRef: ChangeDetectorRef,
    ) {
    }

    /**
     * Creates server form, initializes observables and retrieves current server settings.
     */
    public ngOnInit() {
        let addressField: AbstractControl;
        let portField: AbstractControl;
        let serverGroup: AbstractControl;

        this.serverForm = this.fb.group({
            server: this.fb.group({
                address: [null, [
                    Validators.required,
                    this.patternValidator(
                        /^(?=\d+\.\d+\.\d+\.\d+$)(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.?){4}$/,
                        "Invalid IPv4 address",
                    ),
                ]],
                port: [null, [Validators.required, this.patternValidator(/^\d*$/, "Invalid port")]],
            }),
        });

        addressField = this.serverForm.get("server.address")!;
        portField = this.serverForm.get("server.port")!;
        serverGroup = this.serverForm.get("server")!;

        this.canRestart = combineLatest(
            combineLatest(
                addressField.valueChanges.pipe(mergeMap((value) => {
                    return Promise.resolve().then(() => {
                        if (addressField.valid) {
                            return this.settingsService.storeAddress(value)
                                .catch(this.messageService.errorHandler)
                                .then(() => true);
                        } else {
                            return false;
                        }
                    });
                })),
                portField.valueChanges.pipe(mergeMap((value) => {
                    return Promise.resolve().then(() => {
                        if (portField.valid) {
                            return this.settingsService.storePort(value)
                                .catch(this.messageService.errorHandler)
                                .then(() => true);
                        } else {
                            return false;
                        }
                    });
                })),
            ),
            this.settingsService.serverIsRestarting,
        ).pipe(map(([[validAddress, validPort], serverIsRestarting]) =>
            validAddress && validPort && !serverIsRestarting));

        this.settingsService.getServerSettings().then((settings) => {
            serverGroup.reset(settings);
            this.changeRef.detectChanges();
        }).catch(this.messageService.errorHandler);
    }

    /**
     * Restarts server.
     */
    public restartServer() {
        this.settingsService.restartServer();
    }

    /**
     * Checks if form element has error.
     * @param controlPath Path to form element.
     */
    public hasErrors(controlPath: string) {
        return this.serverForm.get(controlPath)!.errors !== null;
    }

    /**
     * Gets error message for form element (always assumes that element has error).
     * @param controlPath Path to form element.
     */
    public getErrorMsg(controlPath: string) {
        const control = this.serverForm.get(controlPath)!;

        if (control.errors!.required) {
            return "Input is required";
        } else if (control.errors!.invalidPattern) {
            return control.errors!.invalidPattern as string;
        } else {
            return "Invalid path!";
        }
    }

    /**
     * Creates validator for validating regex pattern.
     * @param pattern Pattern to validate.
     */
    private patternValidator(pattern: RegExp, error: string) {
        return (control: AbstractControl) => {
            return !pattern.test(control.value) ? { invalidPattern: error } : null;
        };
    }
}
