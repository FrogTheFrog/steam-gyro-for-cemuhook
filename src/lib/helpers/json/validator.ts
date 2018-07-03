import * as Ajv from "ajv";
import { get, isEqual, set } from "lodash";
import { ValidatorModifier } from "../../../models/interface/validator-modifier.interface";

/**
 * Validates JSON object to ensure that it matches a provided schema.
 * If needed, it will modify provided object before validating it.
 */
export class Validator<T = object> {
    private static ajv = new Ajv({ removeAdditional: "all", useDefaults: true });
    private validationFn: Ajv.ValidateFunction | null = null;
    private modifier: ValidatorModifier | null = null;

    /**
     * @param schema A schema to validate against.
     * @param modifier A modifier to be used to update object.
     */
    constructor(schema?: object, modifier?: ValidatorModifier) {
        if (schema !== undefined) {
            this.setSchema(schema);
        }
        if (modifier !== undefined) {
            this.setModifier(modifier);
        }
    }

    /**
     * Set validator's schema.
     * @param schema A schema to validate against.
     */
    public setSchema(schema: object) {
        if (schema) {
            this.validationFn = Validator.ajv.compile(schema);
        }
        else {
            this.validationFn = null;
        }

        return this;
    }

    /**
     * Set validator's modifier.
     * @param modifier A modifier to be used to update object.
     */
    public setModifier(modifier: ValidatorModifier) {
        if (modifier) {
            this.modifier = modifier;
        }
        else {
            this.modifier = null;
        }

        return this;
    }

    /**
     * Modify and/or validate provided JSON object.
     * @param data JSON object to be validated.
     */
    public validate(data: object) {
        if (this.modifier) {
            // tslint:disable-next-line:no-empty
            while (this.modify(data)) { }
            set(data, this.modifier.controlProperty, this.modifier.latestVersion);
        }

        if (this.validationFn) {
            this.validationFn(data);
        }

        return this;
    }

    /**
     * Retrieve last schema's errors after last validation.
     */
    get errors() {
        if (this.validationFn) {
            return this.validationFn.errors || null;
        }
        else {
            return null;
        }
    }

    /**
     * Retrieve last schema's errors in string format after last validation.
     */
    get errorString() {
        const errors = this.errors;
        return errors !== null ? JSON.stringify(errors, null, "\t") : "";
    }

    /**
     * Returns true is last validate object is valid.
     */
    public isValid() {
        return this.errors === null;
    }

    /**
     * Generate default object which matches provided schema.
     */
    public getDefaultValues() {
        const data = {};
        if (this.validationFn) {
            this.validationFn(data);
            if (this.modifier) {
                set(data, this.modifier.controlProperty, this.modifier.latestVersion);
            }
        }
        return data as T;
    }

    /**
     * Modify provided object.
     * @param data Object to modify.
     */
    private modify(data: object) {
        const controlValue = get(data, this.modifier!.controlProperty, undefined);
        const modifierFieldSet = this.modifier!.fields[controlValue];

        if (modifierFieldSet) {
            // tslint:disable-next-line:forin
            for (const key in modifierFieldSet) {
                const fieldData = modifierFieldSet[key];

                if (fieldData.method) {
                    set(
                        data,
                        key,
                        fieldData.method(
                            get(
                                data,
                                typeof fieldData.oldValuePath === "string" ? fieldData.oldValuePath : key, undefined,
                            ),
                            data,
                        ),
                    );
                }
                else if (typeof fieldData.oldValuePath === "string") {
                    set(data, key, get(data, fieldData.oldValuePath, undefined));
                }
            }
            return !isEqual(controlValue, get(data, this.modifier!.controlProperty, undefined));
        }
        else {
            return false;
        }
    }
}
