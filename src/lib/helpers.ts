import * as fs from 'fs-extra';
import * as Ajv from 'ajv';
import * as _ from 'lodash';
const stripBom: (input: string) => string = require('strip-bom');

export namespace angular {
    export function ngObjectsToArray(importObject: any) {
        let objectArray: any[] = [];
        for (let attribute in importObject) {
            if (typeof importObject[attribute] === 'function')
                objectArray.push(importObject[attribute]);
        }
        return objectArray;
    }
}

export namespace validator {
    export function isValidIPv4(value: string) {
        return /^(?=\d+\.\d+\.\d+\.\d+$)(?:(?:25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]|[0-9])\.?){4}$/.test(value);
    }
}

export namespace json {
    export function read<valueType>(filename: string, fallbackValue: valueType, segments?: string[]) {
        return new Promise<valueType>((resolve, reject) => {
            fs.readFile(filename, 'utf8', (error, data) => {
                try {
                    if (error) {
                        if (error.code === 'ENOENT')
                            resolve(fallbackValue);
                        else
                            reject(error);
                    }
                    else {
                        data = stripBom(data);
                        if (data) {
                            let parsedData = JSON.parse(data);

                            if (parsedData !== undefined) {
                                if (segments) {
                                    let segmentData = parsedData;
                                    for (let i = 0; i < segments.length; i++) {
                                        if (segmentData[segments[i]] !== undefined) {
                                            segmentData = segmentData[segments[i]];
                                        }
                                        else
                                            resolve(fallbackValue);
                                    }
                                    resolve(segmentData);
                                }
                                else
                                    resolve(parsedData);
                            }
                        }
                        else
                            resolve(fallbackValue);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    export function write(filename: string, value: any, segments?: string[]) {
        return Promise.resolve().then(() => {
            if (segments !== undefined)
                return read(filename, {});
            else
                return {};
        }).then((readData) => {
            if (segments !== undefined) {
                let segmentLadder = readData;
                for (let i = 0; i < segments.length - 1; i++) {
                    if (segmentLadder[segments[i]] === undefined) {
                        segmentLadder[segments[i]] = {};
                    }
                    segmentLadder = segmentLadder[segments[i]];
                }
                segmentLadder[segments[segments.length - 1]] = value;
            }
            else
                readData = value;


            return new Promise<void>((resolve, reject) => {
                fs.outputFile(filename, JSON.stringify(readData, null, 4), (error) => {
                    if (error)
                        reject(error);
                    else
                        resolve();
                });
            });
        });
    }

    export interface ValidatorModifier<T> {
        latestVersion: string | number,
        controlProperty: string,
        fields: {
            [controlValue: string]: {
                [fields: string]: {
                    method?: (oldValue: any, self: T) => any,
                    oldValuePath?: string
                }
            }
        }
    }

    export class validator<T = any> {
        private static ajv = new Ajv({ removeAdditional: 'all', useDefaults: true });
        private validationFn: Ajv.ValidateFunction;
        private modifier: ValidatorModifier<T>;

        constructor(schema?: any, modifier?: ValidatorModifier<T>) {
            this.setSchema(schema);

            if (modifier !== undefined)
                this.setModifier(modifier);
        }

        setSchema(schema: any) {
            if (schema != undefined)
                this.validationFn = validator.ajv.compile(schema);
            else
                this.validationFn = undefined;
        }

        setModifier(modifier: ValidatorModifier<T>) {
            this.modifier = modifier;
        }

        validate(data: any) {
            if (this.modifier) {
                while (this.modify(data));
                _.set(data, this.modifier.controlProperty, this.modifier.latestVersion);
            }

            if (this.validationFn) {
                this.validationFn(data);
            }
        }

        get errors() {
            if (this.validationFn) {
                return this.validationFn.errors;
            }
            else
                return [];
        }

        getDefaultValues() {
            let data = {};
            if (this.validationFn) {
                this.validationFn(data);
                if (this.modifier) {
                    _.set(data, this.modifier.controlProperty, this.modifier.latestVersion);
                }
            }
            return data;
        }

        private modify(data: any) {
            let controlValue = _.get(data, this.modifier.controlProperty, undefined);
            let modifierFieldSet = this.modifier.fields[controlValue];

            if (modifierFieldSet !== undefined) {
                for (let key in modifierFieldSet) {
                    let fieldData = modifierFieldSet[key];

                    if (fieldData.method)
                        _.set(data, key, fieldData.method(_.get(data, typeof fieldData.oldValuePath === 'string' ? fieldData.oldValuePath : key, undefined), data));
                    else if (typeof fieldData.oldValuePath === 'string')
                        _.set(data, key, _.get(data, fieldData.oldValuePath, undefined));
                }
                return !_.isEqual(controlValue, _.get(data, this.modifier.controlProperty, undefined));
            }
            else
                return false;
        }
    }
}