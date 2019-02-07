import { JsonValidator, readJson, writeJson } from "..";
import { UserSettings, UserSettingsSchema } from "../../../shared/models";

/**
 * App module responsible for user settings.
 */
export class AppUserSettings {
    /**
     * Current user settings.
     */
    public current: UserSettings;

    /**
     * Disables or enables saving settings.
     */
    public savingDisabled: boolean = false;

    /**
     * Json validator for validating user settings.
     */
    private validator = new JsonValidator(UserSettingsSchema);

    constructor() {
        this.current = this.defaultSettings();
    }

    /**
     * Generates default user settings.
     * @returns Default user settings.
     */
    public defaultSettings() {
        return this.validator.getDefaultValues() as UserSettings;
    }

    /**
     * Read and validate user settings.
     *
     * @param filePath Path to file containing user settings.
     * @returns User settings or `null` if file did not exist.
     */
    public async readSettings(filePath: string) {
        const data = await readJson<UserSettings>(filePath);
        if (data !== null) {
            if (!this.validator.validate(data).isValid()) {
                const message = "Saved settings are invalid (saving is disabled for this session)";
                const error = new Error(message);
                error.stack = `Error: ${message}\r\n${this.validator.errorString}`;
                throw error;
            }
        }
        return data;
    }

    /**
     * Writes user settings to specified file path.
     *
     * @param filePath Path to file to write settings to.
     * @param settings Optional settings value (defaults to current settings).
     */
    public async writeSettings(filePath: string, settings: UserSettings = this.current) {
        if (!this.savingDisabled) {
            return writeJson(filePath, settings);
        }
    }
}
