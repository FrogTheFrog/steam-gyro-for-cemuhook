import { AvailableFilters, availableFilters, FilterData } from "../../controller-api";

/**
 * Interface for user settings.
 */
export interface UserSettings {
    filter: {
        type: AvailableFilters,
        data: FilterData,
    };
    server: {
        address: string,
        port: number,
    };
}

/**
 * Schema for validating user settings.
 */
export const UserSettingsSchema = {
    properties: {
        filter: {
            default: {},
            properties: {
                data: {
                    default: {},
                    properties: {
                        "disabled": {
                            default: [],
                            maxItems: 0,
                            minItems: 0,
                            type: "array",
                        },
                        "low-high-pass": {
                            default: [0, 0],
                            items: {
                                allOf: [
                                    { minimum: 0 },
                                ],
                            },
                            maxItems: 2,
                            minItems: 2,
                            type: "array",
                        },
                    },
                    type: "object",
                },
                type: {
                    default: "disabled",
                    enum: availableFilters,
                    type: "string",
                },
            },
            type: "object",
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
