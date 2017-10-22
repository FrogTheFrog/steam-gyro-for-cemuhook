# Change Log
All notable changes to this project will be documented in this file.

## 1.0.5 - 2017-10-23

### Added
- Fatal error pop up can now be silenced via settings file. App will just close after logging error. This only applies to errors after the settings file itself is validated.

### Fixed
- Re-enabled second process check. Somehow it got disabled in some previous release. This will shutdown app if there is one already open.

## 1.0.4 - 2017-10-20

### Fixed
- Incorrect stick and right pad value ranges. `int16_t` values are now properly remapped to `uint8_t` values. Fixes #1 issue.

## 1.0.3 - 2017-10-17

### Added
- Post scalers were added for gyro and accelerometer. Once the settings file is created, you change those values to whatever number you want. Can be used to increase or decrease sensitivity, however might also cause drifts.

## 1.0.2 - 2017-10-16

### Fixed
- UDP server errors will now be caught properly instead of displaying error for catching errors.

## 1.0.1 - 2017-10-15

### Added
- Windows should display notification if everything is running well.

### Changed
- Will try to display error in error box.

## 1.0.0 - 2017-10-14

### Added
- Everything
