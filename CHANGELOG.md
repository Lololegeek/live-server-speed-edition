## [1.1.5] - 2025-11-06


### Improved

- Change the default value on debounce time (50ms)
- Optimize the code for Live Server reload in 1 Sec !
- Added more Keywords

### Added

- Ignore node_modules and more in the .vscodeignore

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
