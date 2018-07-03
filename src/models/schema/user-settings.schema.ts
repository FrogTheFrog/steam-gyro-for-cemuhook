import { FilterType } from "../interface/filter-type.interface";

export const UserSettingSchema = {
    definitions: {
        filterType: {
            properties: {
                coefficients: {
                    items: {
                        type: "number",
                    },
                    type: "array",
                },
                deviation: {
                    default: {},
                    properties: {
                        max: {
                            default: 0,
                            type: "number",
                        },
                        min: {
                            default: 0,
                            type: "number",
                        },
                        useProvidedData: {
                            default: false,
                            type: "boolean",
                        },
                    },
                    type: "object",
                },
                filterAllAtOnce: {
                    default: false,
                    type: "boolean",
                },
                type: {
                    default: "None" as FilterType["type"],
                    type: "string",
                },
            },
            type: "object",
        },
    },
    properties: {
        enabledFilters: {
            default: {},
            properties: {
                accelerometer: {
                    default: false,
                    type: "boolean",
                },
                gyro: {
                    default: false,
                    type: "boolean",
                },
            },
            type: "object",
        },
        filters: {
            default: {},
            properties: {
                accelerometer: {
                    default: [],
                    items: {
                        $ref: "#/definitions/filterType",
                    },
                    type: "array",
                },
                gyro: {
                    default: [],
                    items: {
                        $ref: "#/definitions/filterType",
                    },
                    type: "array",
                },
            },
            type: "object",
        },
        modifierVersion: {
            type: "number",
        },
        server: {
            default: {},
            properties: {
                address: {
                    default: "127.0.0.1",
                    format: "ipv4",
                    type: "string",
                },
                port: {
                    default: 26760,
                    type: "number",
                },
            },
            type: "object",
        },
    },
    type: "object",
};
