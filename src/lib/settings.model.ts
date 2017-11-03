import { json } from "./helpers";
import * as _ from "lodash";

export namespace userSettings {
    export interface type {
        server: {
            address: string,
            port: number
        },
        silentErrors: boolean,
        postScalers: {
            gyro: {
                x: number,
                y: number,
                z: number
            }, accelerometer: {
                x: number,
                y: number,
                z: number
            }
        }
    }

    export const schema = {
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
            "silentErrors": {
                "type": "boolean",
                "default": false
            },
            "postScalers": {
                "default": {},
                "type": "object",
                "properties": {
                    "gyro": {
                        "default": {},
                        "type": "object",
                        "properties": {
                            "x": {
                                "type": "number",
                                "default": 1
                            },
                            "y": {
                                "type": "number",
                                "default": 1
                            },
                            "z": {
                                "type": "number",
                                "default": 1
                            }
                        }
                    },
                    "accelerometer": {
                        "default": {},
                        "type": "object",
                        "properties": {
                            "x": {
                                "type": "number",
                                "default": 1
                            },
                            "y": {
                                "type": "number",
                                "default": 1
                            },
                            "z": {
                                "type": "number",
                                "default": 1
                            }
                        }
                    }
                }
            },
            "modifierVersion": {
                "type": "number"
            }
        }
    }

    export const modifier: json.ValidatorModifier<type> = {
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