## [1.1.3] - 2025-10-20

### Fixed

- Fixed server start issues where browser/webview wouldn't open due to hardcoded English strings in choice comparisons
- Implemented proper webview creation for server mode with iframe loading the server URL
- Ensured server stops correctly and webview disposes properly
- Prevented multiple server instances by properly managing stopServer function

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
