# Change Log
All notable changes to this project will be documented in this file.

## 1.4.0 - 2020-09-25

### Fixed
* Protocol was not implemented correcly - data was sent up to 5 times repeatedly to the same connection.
* Messages were not displayed properly if the app window was open.

## 1.3.6 - 2020-09-06

### Fixed
* Settings would not save if server failed to start during the startup of the app (#37).

## 1.3.5 - 2020-02-19

### Changed
* Disabled hardware acceleration as it is currently not needed (#33).

### Added
* Kalman-1D filter (just for fun).

## 1.3.4 - 2019-12-28

### Fixed
* Fixed #30 and #31.

### Changed
* Configs for non-windows users will now be saved in "steam-gyro-for-cemuhook" instead of "steam-gyro" to reduce clutter. 

### Added
* HID devices (currently the only ones that are supported, but whatever) will now be handled more gracefully - less errors and snapier device switching.

## 1.3.3 - 2019-10-26

### Added
* Connection icon in the UI will now also indicate if UDP connection is established or not.

## 1.3.2 - 2019-10-25

### Fixed
* #23 hopefully should be fixed now.

### Added
* Linux support by @NickZ.
* Automatic travis builds.

## 1.3.1 - 2019-02-08

### Fixed
- #20 issue.

## 1.3.0 - 2019-02-07

### Added
- Filter support for motion data filtering (#4 issue).

### Fixed
- #7 issue.

## 1.2.0 - 2018-01-09

### Added
- Rudimentary non-fatal error handling via UI. Allows to change server address, etc. if incorrect setting has caused an error. Previously you would have to edit `json` file.
- Gyroscope and accelerometer threshold settings have been added. Gyro threshold is set to `1` (for all 3 axis) and accelerometer threshold is set to `0.01` (for all 3 axis) by default. To disable threshold, set its value to `0`. Threshold values are relative to post-scaler values - `finalThresholdValue = thresholdValue * postScalerValue`.

Threshold represents an absolute minimum difference between old value and new sensor value. This is used to eliminate micro stuttering

## 1.1.2 - 2018-01-01

### Fixed
- App could not properly detect when Steam would decide to turn off motion sensors. Thus resulting in stuck sensor data until app is restarted.

## 1.1.1 - 2017-11-03

### Fixed
- Could not close data stream if UI is restored within 5 seconds (before UI memory is freed).

## 1.1.0 - 2017-11-03

### Added
- Auto-detect feature. App will now watch for usb changes and will try to connect to the first active controller. You no longer need to have connected and active controller when launching this app.
- A simple UI for editing settings in real time. Also allows to select different Steam Controller and observe its data stream.

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
