# Play your favorite CEMU games with your Steam Controller's GYRO!

## Requirements

* Cemu emulator.
* Cemehook with motion source support.
* **Turned on** Steam Controller.

## Before playing  

Make sure that Steam Controller configuration has gyro disabled in places where actual WiiU motion sensor would be used! Might cause undesired effects otherwise.

## How to use

Drag executable anywhere you want and launch it. A settings file will be create in the same directory. If you want, you can change available and click restart on tray icon:

![tray-example](./assets/tray.png "Tray example")

Finally, go to Cemu and make sure motion source is selected.

![cemu-example](./assets/cemu-example.png "Cemu example")

## Resetting position

If you leave Steam Controller motionless, after a few seconds Cemuhook will reset it's position to default position. Basically, place controller in front of your screen if it's not moving in the direction you want and wait.

## Multiple controllers support

Theoretically it should support multiple controllers on a single dongle, however I had no way to test that.

## Icon

The icon you see in image above is licensed, thus I am not allowed to share it.

# Credits

* Huge credits must be given to [kolrabi](https://github.com/kolrabi/steamcontroller). This project is mostly based on information that he/she/it collected about HID.
* Thank you [rajkosto](https://github.com/rajkosto/DS4Windows) for providing tips and source code for UDP server.
