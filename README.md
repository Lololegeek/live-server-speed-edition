🚀 Live Server Speed Edition
A blazing-fast local HTTP server with live reload — built right into VS Code.

Live Server Speed Edition is a lightweight, no-fuss extension that lets you spin up a local HTTP server instantly and reloads your page automatically whenever you make changes. Whether you're prototyping HTML or building a full JS app, this tool keeps your workflow fast and fluid.

⚡ Features

- **One-click server launch** from the status bar
- **Instant live reload** using WebSocket and Chokidar
- **QR Code for mobile access**: Display QR codes directly in WebView to quickly access your server from mobile devices on the local network
- **Multiple preview modes**:
  - 🌐 Open in default browser
  - 🧩 View directly inside VS Code via WebView
  - ⚡ Instant Preview (without server)
- **Protocol support**: HTTP and HTTPS (with self-signed certificates support)
- **HTTPS in WebView**: Full HTTPS support in VS Code WebView with auto-reconnect on connection loss
- **Zero configuration** — just open a folder and go
- **Default port**: 5500
- **Network accessible**: Access your server from other devices on the same network (e.g., mobile testing) using your local IP address
- **Multi-language UI**: English, Français, Español, Deutsch
- **Dynamic UI**: Change language in settings, UI updates instantly (no restart needed)

## Multi-language & Dynamic UI

You can select your preferred language for all extension UI elements:

1. Go to VS Code Settings (`Ctrl+,`)
2. Search for `liveServerSpeed.language`
3. Choose: `en` (English), `fr` (Français), `es` (Español), `de` (Deutsch)

All status bar buttons, tooltips, prompts, quick picks, notifications, and webview loading text will update instantly—no need to restart VS Code!

### Example

If you select Français, you’ll see:

- `Démarrer Live Server SE` (status bar)
- All prompts, quick picks, and notifications in French
- Webview loading text: `Chargement du preview...`

🖥️ How to Use

1. Open a folder in VS Code
2. (Optional) Set your language: Go to Settings > liveServerSpeed.language
3. Click Start Live Server SE in the status bar
4. Choose your preferred view (browser or WebView)
5. Edit your files — the page reloads automatically after one second 💨
6. If you want, you can choose a keyboard key from the settings to restart the server with the same parameters as last time.

📦 Installation
Install from the Visual Studio Code Marketplace Or via CLI:

bash :
code --install-extension Lololegeek.live-server-speed-edition
🛠️ Tech Stack
Express

WebSocket

Chokidar

VS Code API

✨ Why This Edition?
Because traditional live servers can be slow or bloated. This edition focuses on speed, simplicity, native integration, and now multi-language support. No config files. No clutter. Just fast results.

Experimental:

- HTTPS support

👨‍💻 Author
Created with ❤️ by Lololegeek
Want to contribute or suggest a feature? Open an issue or submit a PR!

Let me know if you'd like a little version , just button and it launch in webview for best performance
