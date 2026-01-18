
## [1.2.8] - 2025-12-26

### Fixed

- Fixed inconsistencies and wording in the changelog.

## [1.2.7] - 2025-12-26

### Added

- Notification for 2026.

### Fixed

- Reverted to 1.2.4 because the QR Code and Re-open WebView code disappeared; restored the back button.

## [1.2.6] - 2025-12-03

### Added

- Christmas notification.

### Fixed

- Fixed changelog formatting and wording.

## [1.2.5] - 2025-11-30

### Added

- Back button in server configuration.
- Updated README.md.

### Fixed

- Fixed an issue that prevented the server from launching.

## [1.2.4] - 2025-11-23

### Added

- Re-open WebView button: new status bar button to re-open the WebView after closing it while the server is still running.
- The button appears next to the QR Code button when WebView mode is active.
- Buttons remain visible after closing the WebView, allowing easy re-opening without restarting the server.
- Added multi-language support (EN, FR, ES, DE) for the new button.

### Improved

- Better button visibility logic: QR Code and Re-open WebView buttons now stay visible when the WebView is closed but the server is still active.
- Buttons only hide when the server is stopped.
- Server state variables (URL, port, HTTPS) are preserved when the WebView is closed.

## [1.2.3] - 2025-11-14

### Added

- QR Code button: new status bar button to display QR codes for easy mobile access (visible only when WebView is active).
- QR Code modal in WebView: QR code displays directly in the WebView with network access information and detected IP address.
- Network IP display: shows the detected IP address from settings (liveServerSpeed.defaultIP) or the auto-detected network interface.
- Console filtering: filters out unwanted native logs, telemetry data, and system messages from the WebView display.
- HTTP WebView support: WebView mode is available for HTTP servers (not available for HTTPS due to certificate limitations).

### Improved

- Code cleanup: extracted IP detection logic into a reusable detectNetworkIP() function to reduce duplication.
- Code deduplication: created extractCssAndJsFromHtml() helper to eliminate ~120 lines of duplicated code in Instant Preview.
- Better error handling: added guards and fallback timeouts for WebView loading state.
- WebSocket resilience: improved WebSocket error handling and connection state tracking.

### Fixed

- Fixed "WebView loading" text not disappearing by adding a 3-second fallback timeout.
- Fixed QR code modal not displaying due to missing null checks on DOM elements.
- Fixed console log pollution in WebView caused by native Electron and telemetry messages.
- Improved WebView iframe loading detection using capture-phase event listeners.

## [1.2.2] - 2025-11-09

### Added

- Allow changing the UI language in settings.
- Hotkey to launch the server.

## [1.2.1] - 2025-11-08

### Fixed

- Fixed a bug that prevented buttons from displaying (caused by excluding node_modules in .vscodeignore).

### Added

- Added category.

## [1.2.0] - 2025-11-08

### Improved

- Changed the default debounce time to 50 ms.
- Optimized Live Server reload to ~1 second.
- Added more keywords.
- Updated to 1.2.0 to resolve versioning issues in the VS Code Marketplace.

### Added

- Ignore node_modules and other files in .vscodeignore.
- Reduced extension size.

## [1.1.5-beta.1] - 2025-11-05

### Added

- HTTPS support (no certificates).
- New settings options.
- More robust WebView in HTTP mode.
- Changed text for "Start Fast HTTP".

### Fixed

- Fixed the GitHub link.

## [1.1.4] - 2025-11-02

### Added

- Added keywords.

## [1.1.3] - 2025-10-20

### Fixed

- Fixed server start issues where the browser/WebView wouldn't open due to hardcoded English strings in choice comparisons.
- Implemented proper WebView creation for server mode with an iframe loading the server URL.
- Ensured server stops correctly and WebView disposes properly.
- Prevented multiple server instances by properly managing the stopServer function.

### Added

- Removed unnecessary comments.
- Added debounce settings.

## [1.1.2] - 2025-10-14

### Added

- Multi-language UI: English, French, Spanish, German.
- All UI elements (status bar, tooltips, prompts, quick picks, notifications, WebView loading text) are localized.
- Language can be changed in settings and applies instantly (no restart required).
- Localized error messages and quick pick options.
- Added CHANGELOG.md.

### Improved

- UI updates dynamically when the language changes.
- More robust handling of configuration changes.

### Fixed

- All prompts and choices now respect the selected language.