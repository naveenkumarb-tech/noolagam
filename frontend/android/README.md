# Noolagam for Android

The Android app wraps the same React code as the website using [Capacitor](https://capacitorjs.com). Screens and features are identical, and there is no separate Android UI to maintain.

For the project as a whole, see the [main README](../../README.md).

<img src="../../docs/screenshots/android-home.png" alt="Home screen in the Android app" width="280">

| | |
|---|---|
| **App ID** | `com.noolagam.app` |
| **Supported** | Android 7.0 (API 24) and newer, with an up-to-date Android System WebView |
| **Targets** | Android 16 (API 36) |
| **Tested on** | Android 15 emulator |
| **Build type** | Debug, for installing directly rather than through the Play Store |

## Before you build

The app needs a running backend, and its address is built into the APK when you build it.

| Backend | Build with | Works |
|---|---|---|
| On your computer | `http://<your-computer's-address>:8000` | Only on the same Wi-Fi, while your computer is on |
| Hosted online | `https://your-api-address` | Anywhere |

To run the backend on your computer, start from the project's root folder:

```bash
docker compose up -d
```

Don't use `localhost` as the address, because on a phone that means the phone itself. To find your computer's address on Linux:

```bash
hostname -I
```

## Build the APK

You only need Docker. Java and the Android SDK are provided by [`android.Dockerfile`](../android.Dockerfile), so there's nothing else to install.

From the project's root folder:

```bash
frontend/build-apk.sh http://192.168.1.50:8000
```

Replace the address with your own. The result is `apk/noolagam-debug.apk`, which Git ignores. The first build takes several minutes because it downloads the Android tools, and later builds take a minute or two.

## Install it on a phone

**1. Copy the APK to your phone.** The most reliable ways are a USB cable, set to **File transfer** on the phone, or Google Drive. Don't email it, as Gmail may block APK files.

To download it over Wi-Fi instead, start a temporary server on your computer from the project's root folder:

```bash
docker run --rm -p 8090:80 -v "$PWD/apk":/usr/share/nginx/html:ro nginx:alpine
```

Then open `http://<your-computer's-address>:8090/noolagam-debug.apk` in the phone's browser, and press `Ctrl+C` on your computer when it's finished. If the download stalls, use USB or Google Drive.

**2. Install it.** Tap the file, allow installs from that app if Android asks, and tap **Install**. Play Protect may warn you about an unknown app, which is expected for a debug build. Choose **More details**, then **Install anyway**.

**3. Open Noolagam** and log in, or create an account.

To update the app, build again and install the new APK over the old one. You stay logged in.

## Differences from the website

| | Website | Android app |
|---|---|---|
| **Refresh token** | httpOnly cookie | The app's private storage, through `@capacitor/preferences` |
| **Identifies itself with** | Nothing extra | `X-Client-Type: native` header |
| **Back** | The browser's button | Android's Back: closes a dialog, then goes back a screen, then exits |
| **Password reset links** | Open in the browser | Also open in the browser. Set the new password there, then log in to the app |

## Security notes

- **Login storage:** the refresh token is in storage only this app can read on a normal phone, and that storage is excluded from Android backups. It isn't separately encrypted, so a rooted phone could read it.
- **Token exposure:** the API only returns a refresh token in a response body after a password is checked, or in exchange for a refresh token. A browser's cookie alone never reveals one.
- **Plain `http://`:** the app only allows it when built with an `http://` address, for testing on a home network. An `https://` build blocks it. Use `https://` for anything beyond testing, as `http://` sends passwords unencrypted.
- **Allowed origins:** the backend's `CORS_ORIGINS` must include `http://localhost` and `https://localhost`, which is where the app's pages run from. The default settings already do.

## Troubleshooting

**"We couldn't reach the server"**
- Check that the phone is on the same Wi-Fi as your computer, not mobile data or a guest network.
- Check that the backend is running: open `http://<your-computer's-address>:8000/health` in the phone's browser.
- If that doesn't open either, your computer's firewall may be blocking it. With `ufw`, for example: `sudo ufw allow from 192.168.1.0/24 to any port 8000 proto tcp`, using your own network's range.
- If your computer's address has changed, rebuild with the new one. Reserving the address in your router's settings prevents this.

**"App not installed", or a signature conflict**
- Android refuses to update an app signed with a different key. Builds on one computer share a key, kept in the `noolagam-gradle-cache` Docker volume. If the APK came from another computer, or that volume was deleted, uninstall the old app first. Doing that logs you out, but your books are safe on the server.

**The screens look unstyled**
- Update **Android System WebView** in the Play Store. The app uses it to draw its screens, and it relies on modern CSS.

**The sign-in page doesn't reach a hosted backend**
- Make sure the APK was built with that backend's `https://` address, and that its certificate is valid.

## How the Android project is organised

| Path | Purpose |
|---|---|
| [`../capacitor.config.ts`](../capacitor.config.ts) | App ID and name, and whether plain `http://` is allowed |
| [`../build-apk.sh`](../build-apk.sh) | Builds the web app, copies it into this project, and builds the APK |
| [`../src/api/tokenStorage.ts`](../src/api/tokenStorage.ts) | Where the login is kept on the web and on Android |
| [`../src/androidBackButton.ts`](../src/androidBackButton.ts) | Android's Back button |
| [`app/src/main/AndroidManifest.xml`](app/src/main/AndroidManifest.xml) | App permissions, backup and `http://` settings |
| [`app/src/main/res/`](app/src/main/res/) | App icon and splash screen |

Most changes belong in the React code in [`frontend/src`](../src), not in this folder. The app's copy of the web files, in `app/src/main/assets/public`, is generated by each build, so don't edit it.

## Not built yet

- A signed release build for the Play Store
- Building and publishing the APK with GitHub Actions
- Opening reset links directly in the app
- Using the app without a connection
