import { json } from "./helpers";
import { Filter } from "./filter";
import * as _ from "lodash";

export namespace userSettings {
    export interface Type {
        server: {
            address: string,
            port: number
        },
        silentErrors: boolean,
        enabledFilters: {
            gyro: boolean,
            accelerometer: boolean
        }
        filters: {
            gyro: Filter.Type[], 
            accelerometer: Filter.Type[]
        }
    }

    export const schema = {
        "definitions": {
            "filterType": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "default": "None"
                    },
                    "filterAllAtOnce": {
                        "type": "boolean",
                        "default": false
                    },
                    "deviation": {
                        "default": {},
                        "type": "object",
                        "properties": {
                            "min": {
                                "type": "number",
                                "default": 0
                            },
                            "max": {
                                "type": "number",
                                "default": 0
                            }
                        }
                    },
                    "coefficients": {
                        "type": "array",
                        "items": {
                            "type": "number"
                        }
                    }
                }
            }
        },
        "type": "object",
        "properties": {
            "server": {
                "default": {},
                "type": "object",
                "properties": {
                    "address": {
                        "type": "string",
                        "default": "127.0.0.1"
                    },
                    "port": {
                        "type": "number",
                        "default": 26760
                    },
                }
            },
            "enabledFilters": {
                "default": {},
                "type": "object",
                "properties": {
                    "gyro": {
                        "type": "boolean",
                        "default": false
                    },
                    "accelerometer": {
                        "type": "boolean",
                        "default": false
                    }
                }
            },
            "silentErrors": {
                "type": "boolean",
                "default": false
            },
            "filters": {
                "default": {},
                "type": "object",
                "properties": {
                    "gyro": {
                        "default": [] as any,
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/filterType"
                        }
                    },
                    "accelerometer": {
                        "default": [] as any,
                        "type": "array",
                        "items": {
                            "$ref": "#/definitions/filterType"
                        }
                    }
                }
            },
            "modifierVersion": {
                "type": "number"
            }
        }
    }

    export const modifier: json.ValidatorModifier<Type> = {
        controlProperty: 'modifierVersion',
        latestVersion: 0,
        fields: {
            undefined: {
                'version': { method: () => 0 },
                'server': {
                    method: (oldValue, self) => {
                        return {
                            address: _.get(self, 'server'),
                            port: _.get(self, 'port'),
                        }
                    }
                },
            }
        }
    }
}