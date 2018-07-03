import { get } from "lodash";
import { ValidatorModifier } from "../interface/validator-modifier.interface";

export const UserSettingsModifier: ValidatorModifier = {
    controlProperty: "modifierVersion",
    fields: {
        undefined: {
            server: {
                method: (oldValue, self) => {
                    return {
                        address: get(self, "server"),
                        port: get(self, "port"),
                    };
                },
            },
            version: { method: () => 0 },
        },
    },
    latestVersion: 0,
};
