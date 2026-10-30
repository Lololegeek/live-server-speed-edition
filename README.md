# Live Server Speed Edition 1.3.0

Local previews for static HTML, PHP and JavaScript/TypeScript development servers, with live editing, browser previews and a VS Code WebView.

## Start a preview

Open a trusted workspace and click **Start Live Server SE** (`Ctrl+Alt+L`, or `Cmd+Alt+L` on macOS). Choose the runtime, public port, access scope, HTTP/HTTPS and preview window. Right-click HTML or PHP files to reuse your last parameters or choose new ones.

| Mode | What runs | Unsaved edits |
| --- | --- | --- |
| Static | Built-in HTTP server | HTML, CSS and JS buffers are served directly from the editor |
| PHP | Your installed PHP CLI, behind the preview server | Editor buffers are written to an isolated temporary project copy, then PHP executes that copy |
| Framework | An existing package.json script using npm, pnpm, yarn or Bun | The development server runs against an isolated temporary copy; its compiler/HMR sees editor changes |
| Attach | An already running localhost HTTP(S) server | Its own save/watch behavior; the extension cannot inject editor buffers into an external process |

PHP must be installed separately. Set `liveServerSpeed.phpPath` if `php` is not on PATH. JavaScript/TypeScript framework dependencies must already be installed. No runtimes or dependencies are downloaded automatically.

Detected projects include React, Vue, Angular, Vite, Svelte/SvelteKit, Next, Nuxt, Astro, Solid, Preact, Remix/React Router, Qwik, PHP and static sites. The generic script runner also works with other tools that expose a local HTTP development server. TS/TSX, JSX, Vue and Svelte compilation is performed by your project's toolchain. Static mode serves existing files/builds; it does not compile framework source files.

For framework mode, enter the script name and the URL that the script actually listens on. For example, use a `dev` script configured for `http://127.0.0.1:5173`. The extension checks that this port is free and waits up to 60 seconds for startup. Framework WebSocket upgrades are forwarded so native HMR can work through the preview URL. Use **Attach** if the process already runs.

## Lite mode and visible buttons

Set `liveServerSpeed.interfaceMode` to `lite` for a one-click Start/Stop workflow. The first launch infers the current workspace/file and runtime. HTML opens directly, PHP uses the PHP runtime, and a detected development script uses framework mode. The initial preview uses localhost HTTP and `defaultPreview`; set `upstreamUrl` to your framework's actual address before using its first Lite launch. Subsequent launches reuse that workspace's last parameters. **Configure Server...** opens the full setup at any time, and **Quick Start** is also available in Full mode.

Lite hides auxiliary status buttons. Full mode provides independent `showStartButton`, `showQrButton`, `showReopenButton` and `showCopyUrlButton` settings. They take effect immediately; commands and shortcuts remain available even if all buttons are hidden. Lite is an interface mode in the same extension, not a separate Marketplace package.

## Live editing and reload

With `liveServerSpeed.liveEditing` enabled (default), changes are sent after editor updates without requiring Save. HTML/JS changes trigger reload, and stylesheet changes replace stylesheet URLs while preserving the page. Scroll position is restored after full reloads when session storage is available. PHP needs actual execution; frameworks need actual compilation. Updates therefore include that runtime's execution/build time and are not guaranteed to be instantaneous.

PHP and framework modes create a temporary copy when started. Changes in the source workspace are synchronized to it, and unsaved editor buffers override their files in that copy. Original files are not overwritten. Stop/restart removes the copy. JavaScript dependencies are linked from installed `node_modules`; PHP `vendor` dependencies are copied so Composer autoload paths stay inside the live copy. Other project symlinks are skipped and logged. Very large projects can take time to copy. Absolute project paths, monorepo packages outside the selected workspace, native addons, custom framework security policies and tools that resolve workspace dependencies through real symlinks may need live editing disabled. PHP applications that write data do so in the temporary copy while this mode is enabled.

Managed frameworks use their own HMR by default (`nativeHmr: true`), avoiding a second full reload watcher that would discard application state. Set it to false for a framework without HMR. HTTP request logging is opt-in (`requestLogging`) to avoid formatting/output work on every asset request. Temporary copies use bounded batches and copy-on-write filesystem copies where supported, with normal copies as a fallback. Pending editor writes are grouped by file; duplicate contents are not written again.

The dedicated **Instant Preview** command opens an unsaved HTML buffer on an ephemeral localhost port. Its CSS and JavaScript editor buffers are also served without saving. This preview preserves normal document structure, resource URLs, module scripts, fonts, images and fetch requests.

## WebView file information

Inside the WebView, download links show a file information card with filename, size (when the server provides Content-Length), and media type. The injected client checks link headers using **HEAD**; it does not request the file body. The card has no download button. Recognized download extensions, the HTML `download` attribute and Content-Disposition attachments are handled. Remote servers may not permit metadata checks; unknown values are displayed as unknown.

This applies to ordinary links in pages where the reload client is allowed to run. Downloads initiated directly by custom JavaScript, forms, browser APIs, or pages whose CSP blocks the injected client are not intercepted. Browser mode retains normal browser download behavior.

## Access and HTTPS

Choose **Localhost only** for local previews or **Local network** for phone testing. The QR button generates its image locally, without a CDN or internet connection. **Copy URL** copies the current entry URL. Network previews expose the served directory to devices able to reach the chosen port; file paths outside that root, hidden paths, dependency directories and symlink escapes are blocked by the static server. Upstream framework servers keep their own route and filesystem rules.

HTTPS accepts a configured certificate/key pair or generates a cached self-signed certificate for localhost. Browsers may require accepting that certificate; the WebView may reject it. For HTTPS WebView/mobile testing, supply a certificate trusted by the client and valid for the URL you use. Content Security Policy from upstream applications is preserved; restrictive policies can block injected reload code.

## Settings

| Setting (`liveServerSpeed.*`) | Purpose |
| --- | --- |
| `interfaceMode` | Full setup or Lite one-click workflow |
| `showStartButton`, `showQrButton`, `showReopenButton`, `showCopyUrlButton` | Status button visibility |
| `defaultPreview`, `liteRuntime` | Initial Lite preview and runtime |
| `nativeHmr`, `requestLogging` | Framework HMR preference and opt-in request logs |
| `port` | Public preview port, default 5500 |
| `serverRoot`, `entryFile` | Served directory and entry path, relative to that directory |
| `liveEditing` | Reflect unsaved editor buffers |
| `frameworkMode` | Auto-select existing static build output, or serve the configured root |
| `packageManager`, `upstreamUrl` | Managed framework command and its local URL |
| `phpPath` | PHP CLI executable |
| `spaFallback` | Serve root index.html for extensionless HTML routes |
| `debounceTime` | File watcher batching delay |
| `usePolling` | Compatibility fallback when native filesystem events fail |
| `ignoredPaths`, `reloadExtensions` | Watcher exclusions and file type filters |
| `headers` | Additional response headers |
| `httpsCertPath`, `httpsKeyPath` | Custom TLS certificate/key |
| `language` | Auto, English, French, Spanish, German, Italian, Portuguese, Japanese, Chinese, Korean or Russian for translated status text and existing messages. Some setup prompts remain in English. |

Commands include Start/Stop, Restart, Reuse Last Parameters, Instant Preview, Reopen WebView, QR, Copy URL, Detect Web Project, Show Logs and Settings. Last launch parameters persist per workspace. Multiple workspace folders are selected explicitly or inferred from the clicked file. One preview is managed per VS Code window.

## Development

```sh
npm ci
npm test
npm run package
```

Tests cover static routing, traversal/symlink protection, WebSockets, watcher cleanup, port collisions, HEAD metadata, framework HMR proxying, live editing copies, PHP execution (requires PHP CLI), and Vite React TSX transforms. CI runs on Windows/Linux with Node 20/22 and PHP 8.3 and packages a VSIX artifact.

The code is divided into commands, configuration, lifecycle, networking/path validation, static gateway, reload client, proxying, TLS, process supervision, temporary live editing copies and UI modules.

MIT — [Lololegeek](https://github.com/Lololegeek).

### Performance measurement

Run `npm run benchmark` for a synthetic 1,001-file copy and 201 editor updates. It reports elapsed time and actual buffer writes; results depend on the filesystem and computer. Automated tests verify that a burst for one file is coalesced and identical subsequent contents are skipped, without modifying the original file.
