export interface ValidatorModifier {
    latestVersion: string | number;
    controlProperty: string;
    fields: {
        [controlValue: string]: {
            [fields: string]: {
                method?: (oldValue: any, self: object) => any,
                oldValuePath?: string,
            },
        },
    };
}
