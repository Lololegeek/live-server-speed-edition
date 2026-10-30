# Changelog

## 1.3.0

This release incorporates the existing 1.3.0 work from PR #2 and replaces the duplicated preview implementation with shared modules.

### Lite and performance follow-up

- Full/Lite interface modes, one-click inferred/reused launch parameters and an explicit Configure Server command.
- Independent Start/Stop, QR, Reopen and Copy URL visibility settings, applied immediately.
- Per-file editor write coalescing, unchanged-buffer write suppression, bounded project copy batches and filesystem copy-on-write hints.
- Framework-native HMR by default without a duplicate reload watcher; HTTP request logs are opt-in.
- Synthetic performance benchmark and additional regression tests.
- Windows cmd invocation uses verbatim arguments; failed process startup includes recent process output.

### Added

- PHP CLI runtime with executable PHP responses and reload for PHP/HTML/CSS/JS edits.
- Unsaved live editing through an isolated temporary project copy for PHP and managed framework scripts.
- Generic npm/pnpm/Yarn/Bun development script runner, local upstream attachment and WebSocket HMR forwarding.
- Detection for React, Vue, Angular, Vite, Svelte, Next, Nuxt, Astro, Solid, Preact, Remix, Qwik and PHP.
- WebView download link metadata cards using HEAD requests, without requesting download bodies.
- Offline QR generation, Copy URL, persisted workspace launch parameters and explicit localhost/LAN access.
- Static editor-buffer preview with correct resource/module URLs, CSS replacement and scroll restoration.
- Windows/Linux CI and server/runtime regression coverage.

### Fixed

- TypeScript annotations embedded in browser JavaScript and inconsistent/deprecated WebView resource handling.
- Request path traversal and external symlink access in the static server.
- HTML injection for query strings and directory indexes; case-insensitive closing body tags.
- Leaked watchers/WebSocket clients and 10 ms polling; native events are now the default.
- Port collision/startup error propagation and awaited shutdown before restart.
- Prefix-based workspace containment checks, first-workspace assumptions and wrong entry URL resolution.
- Missing command registration, language changes resetting running status and CDN-dependent QR rendering.
- Static PHP source exposure and public-source templates incorrectly treated as compiled builds.

### Compatibility

- PHP must be installed separately; framework dependencies and scripts are supplied by the project.
- External server attachment follows that server's own save behavior.
- HTTPS WebViews require a client-trusted certificate. Restrictive upstream CSP can block injected reload code.
- File metadata interception covers ordinary links, not arbitrary script/form/browser-initiated downloads.
- A single server is managed per VS Code window. New setup/runtime prompts currently use English; existing status translations remain available.
