# Release work and roadmap

The original main-branch roadmap is preserved below, with its current implementation status.

## Implemented in the 1.3.0 PR

- [x] Server logs panel (Output channel; per-request logging is opt-in).
- [x] Custom response headers.
- [x] Static/build previews, generic framework development scripts and HMR proxying. SSR is handled by the selected framework server, not by a new extension compiler.
- [x] Configurable status buttons and Full/Lite interface modes.
- [x] One-click Lite launch and explicit Configure Server command.
- [x] Local server for unsaved HTML preview, PHP runtime and framework live editing copies.
- [x] Bounded copy batches, coalesced editor writes and unchanged-content suppression.
- [x] Reproducible synthetic performance benchmark.

## Original main-branch ideas still open

- [ ] Standalone CLI mode using the shared gateway/runtime modules.
- [ ] Real Back navigation throughout the configuration wizard.
- [ ] Optional custom CSS/JS injection with explicit file selection and CSP handling.
- [ ] Multiple simultaneous server instances per VS Code window.
- [ ] Configurable API proxy routes (the existing whole-server/HMR proxy is already implemented).

## Additional follow-ups

- [ ] Translate new setup, runtime and file metadata prompts into all supported languages.
- [ ] Additional real framework/monorepo integration fixtures beyond Vite React TSX.
- [ ] Progress/cancellation UI during initial copy and build readiness.
- [ ] Restore browser state beyond scroll position; optional device synchronization.
- [ ] Standalone GUI/EXE and optional browser companion extension.
