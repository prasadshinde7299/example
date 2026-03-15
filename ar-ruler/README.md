# AR Ruler (WebXR)

Measure real-world distances by placing two points in AR. Built with Three.js + WebXR hit-test.

## Features
- Hit-test reticle to find horizontal/vertical surfaces
- Tap to place two markers; a line is rendered between them
- Live distance readout with unit toggle (m, cm, in)
- Reset button to clear the measurement

## Requirements
- A WebXR AR-capable device (Android + Chrome with ARCore is typical)
- Secure context is required for AR: HTTPS or `localhost`

## Run locally (quick start)
From the repo root:

```bash
npx http-server /workspace/ar-ruler -p 8080
```

Then open `http://localhost:8080` in a compatible browser.

### Test on an Android device (no HTTPS needed)
Use ADB reverse so the device can access your desktop `localhost` (which counts as secure for WebXR):

```bash
# In one terminal on your computer
npx http-server /workspace/ar-ruler -p 8080

# In another terminal, with the phone connected via USB and USB debugging enabled
adb reverse tcp:8080 tcp:8080
```

On the phone, open Chrome and navigate to `http://localhost:8080`.

### Alternative: HTTPS tunnel
If ADB reverse is not an option, use a tunnel that provides HTTPS, e.g. `ngrok` or `cloudflared`:

```bash
# Example with cloudflared (no account needed)
# Install once: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation
cloudflared tunnel --url http://localhost:8080
```

Open the provided HTTPS URL on your phone.

## Usage
- Move your device to detect a surface; the teal ring reticle appears when a plane is found.
- Tap once to set the first point, tap again to set the second.
- Use the Units button to switch between meters, centimeters, and inches.
- Use Reset to start a new measurement.

## Notes
- WebXR AR support varies by device/browser. Desktop browsers generally do not support AR sessions; use a supported phone.
- If the AR button doesn’t appear, your device or context may not support required features.

## License
MIT