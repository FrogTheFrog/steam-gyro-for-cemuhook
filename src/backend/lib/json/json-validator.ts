import * as Ajv from "ajv";

/**
 * Validates JSON object to ensure that it matches a provided schema.
 */
export class JsonValidator<T = object> {
    private static ajv = new Ajv({ removeAdditional: "all", useDefaults: true });
    private validationFn: Ajv.ValidateFunction | null = null;

    /**
     * @param schema A schema to validate against.
     */
    constructor(schema?: object) {
        if (schema !== undefined) {
            this.setSchema(schema);
        }
    }

    /**
     * Set validator's schema.
     * @param schema A schema to validate against.
     */
    public setSchema(schema: object) {
        if (schema) {
            this.validationFn = JsonValidator.ajv.compile(schema);
        }
        else {
            this.validationFn = null;
        }

        return this;
    }

    /**
     * Modify and/or validate provided JSON object.
     * @param data JSON object to be validated.
     */
    public validate(data: object) {
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
        return errors !== null ? JSON.stringify(errors, null, "    ") : "";
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
        }
        return data as T;
    }
}
