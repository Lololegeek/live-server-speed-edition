## [1.2.3] - 2025-11-14

### Added

- **QR Code Button**: New status bar button to display QR codes for easy mobile device access (visible only when WebView is active)
- **QR Code Modal in WebView**: QR code displays directly in the WebView with network access information and detected IP address
- **Network IP Display**: QR code modal shows the detected IP address from settings (liveServerSpeed.defaultIP) or auto-detected network  interface
- **Console Filtering**: Removes unwanted native logs, telemetry data, and system messages from WebView display
- **HTTP WebView Support**: WebView mode is available for HTTP servers (not available for HTTPS due to certificate limitations)

### Improved

- **Code Cleanup**: Extracted IP detection logic into a reusable `detectNetworkIP()` function to reduce code duplication
- **Code Deduplication**: Created `extractCssAndJsFromHtml()` helper to eliminate ~120 lines of duplicated code in Instant Preview
- **Better Error Handling**: Added guards and fallback timeouts for loading state in WebView
- **WebSocket Resilience**: WebSocket connection includes proper error handling and connection state tracking

### Fixed

- Fixed "webview loading" text not disappearing by adding 3-second fallback timeout
- Fixed QR code modal not displaying due to missing null checks on DOM elements
- Fixed console logs pollution in WebView from native Electron and telemetry messages
- Improved WebView iframe loading detection with capture phase event listeners

## [1.2.2] - 2025-11-09

### Added

- Change settings lang on your choices
- Hotkey for launch server

## [1.2.1] - 2025-11-08

### Fixed

- I fixed the bug that was causing the buttons not to display (The bug is here because i have exclude node_modules in .vscodeignore)

### Added

- Added category

## [1.2.0] - 2025-11-08

### Improved

- Change the default value on debounce time (50ms)
- Optimize the code for Live Server reload in 1 Sec !
- Added more Keywords
- Update to 1.2.0 because problem for the versions in VS Code marketplace

### Added

- Ignore node_modules and more in the .vscodeignore
- Reduce the size of extension

## [1.1.5-beta.1] - 2025-11-05

### Added

- HTTPS Support , no certificates 😭
- New choice Settings
- More robust webview in HTTP
- Change text of Start Fast HTTP

### Fixed

- Fixed the github link

## [1.1.4] - 2025-11-02

### Added

- Added keywords

## [1.1.3] - 2025-10-20

### Fixed

- Fixed server start issues where browser/webview wouldn't open due to hardcoded English strings in choice comparisons
- Implemented proper webview creation for server mode with iframe loading the server URL
- Ensured server stops correctly and webview disposes properly
- Prevented multiple server instances by properly managing stopServer function

### Added

- Delete commentaries
- Debounce settings

## [1.1.2] - 2025-10-14

### Added

- Multi-language UI: English, French, Spanish, German
- All UI elements (status bar, tooltips, prompts, quick picks, notifications, webview loading text) are localized
- Language can be changed in settings and applies instantly (no restart needed)
- Localized error messages and quick pick options

### Improved

- UI updates dynamically when language changes
- More robust handling of configuration changes

### Fixed

- All prompts and choices now respect the selected language

## [1.1.1] - 2025-10-11

## 1.1.0 Official release with major performance improvements and new features

## [1.2.2] - 2025-11-09

### Added

- Change settings lang on your choices
- Hotkey for launch server

## [1.2.1] - 2025-11-08

### Fixed

- I fixed the bug that was causing the buttons not to display (The bug is here beceause i have exclude node_modules in .vscodeignore)

### Added

- Added category

## [1.2.0] - 2025-11-08

### Improved

- Change the default value on debounce time (50ms)
- Optimize the code for Live Server reload in 1 Sec !
- Added more Keywords
- Update to 1.2.0 because problem for the versions in VS Code marketplace

### Added

- Ignore node_modules and more in the .vscodeignore
- Reduce the size of extension

## [1.1.5-beta.1] - 2025-11-05

### Added

- HTTPS Support , no certificates 😭
- New choice Settings
- More robust webview in HTTP
- Change text of Start Fast HTTP

### Fixed

- Fixed the github link

## [1.1.4] - 2025-11-02

### Added

- Added keywords

## [1.1.3] - 2025-10-20

### Fixed

- Fixed server start issues where browser/webview wouldn't open due to hardcoded English strings in choice comparisons
- Implemented proper webview creation for server mode with iframe loading the server URL
- Ensured server stops correctly and webview disposes properly
- Prevented multiple server instances by properly managing stopServer function

### Added

- Delete commentaries
- Debounce settings

## [1.1.2] - 2025-10-14

### Added

- Multi-language UI: English, French, Spanish, German
- All UI elements (status bar, tooltips, prompts, quick picks, notifications, webview loading text) are localized
- Language can be changed in settings and applies instantly (no restart needed)
- Localized error messages and quick pick options

### Improved

- UI updates dynamically when language changes
- More robust handling of configuration changes

### Fixed

- All prompts and choices now respect the selected language

## [1.1.1] - 2025-10-11

## 1.1.0 Official release with major performance improvements and new features
