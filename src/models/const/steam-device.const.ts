export const SteamDeviceScales = {
    accelerometer: 2,
    gyro: 2000.0,
    quaternion: 1,
};

export const SteamDeviceMinValues = {
    accelerometer: SteamDeviceScales.accelerometer / 32768.0,
    gyro: SteamDeviceScales.gyro / 32768.0,
    quaternion: SteamDeviceScales.quaternion / 32768.0,
};
