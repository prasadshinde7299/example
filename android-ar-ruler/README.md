# Android AR Ruler

A native Android app that measures real-world distances by placing two points in AR using ARCore + Sceneform.

## Requirements
- Android device with ARCore support
- Android Studio Giraffe+ (or command line tools)
- JDK 17

## Build & Run (Android Studio)
1. Open the project at `/workspace/android-ar-ruler` in Android Studio.
2. Let Gradle sync and download dependencies.
3. Connect an ARCore-capable device with USB debugging enabled.
4. Run the `app` configuration.

## Build & Run (CLI)
From the project root:

```bash
./gradlew :app:assembleDebug
```

The APK will be at `app/build/outputs/apk/debug/app-debug.apk`.

Install to a connected device:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Usage
- Move the device to detect a plane.
- Tap once to place the first marker, tap again for the second.
- The app draws a line and shows the distance. Use the Units button to switch between meters, centimeters, and inches. Use Reset to start over.

## Notes
- Camera permission is required.
- AR requires good lighting and detectable surfaces.

## License
MIT