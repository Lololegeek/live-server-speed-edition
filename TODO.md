# Improvements for Live Server Speed Edition 1.1.5

## Completed

- [x] Multi-language UI (en, fr, es, de)
- [x] Language setting applies instantly (no restart needed)
- [x] Robust config change handling
- [x] Added Keywords
- [x] Add configuration settings for debounce time
- [x] Improve webview reload reliability

## Potential Future Improvements

- Add HTTPS support with certificates
- More languages


## Fixed Issues

- [x] Fixed server start issues where browser/webview wouldn't open due to hardcoded English strings in choice comparisons
- [x] Implemented proper webview creation for server mode with iframe loading the server URL
- [x] Ensured server stops correctly and webview disposes properly
- [x] Prevented multiple server instances by properly managing stopServer function
