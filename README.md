# 🚀 Live Server Speed Edition

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/Lololegeek.live-server-speed-edition?label=Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=Lololegeek.live-server-speed-edition)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/Lololegeek.live-server-speed-edition?label=Installs)](https://marketplace.visualstudio.com/items?itemName=Lololegeek.live-server-speed-edition)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/Lololegeek.live-server-speed-edition?label=Rating)](https://marketplace.visualstudio.com/items?itemName=Lololegeek.live-server-speed-edition)
[![License](https://img.shields.io/github/license/Lololegeek/live-server-speed-edition)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/Lololegeek/live-server-speed-edition)](https://github.com/Lololegeek/live-server-speed-edition/issues)

A blazing-fast local HTTP server with live reload — built right into VS Code.

---

## ⚡ Features

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

---

## 🌍 Multi-language & Dynamic UI

You can select your preferred language for all extension UI elements:

1. Go to VS Code Settings (`Ctrl+,`)  
2. Search for `liveServerSpeed.language`  
3. Choose: `en` (English), `fr` (Français), `es` (Español), `de` (Deutsch)  

Example in French:  
- Status bar: `Démarrer Live Server SE`  
- Webview loading text: `Chargement du preview...`  

---

## 🖥️ How to Use

1. Open a folder in VS Code  
2. (Optional) Set your language: Go to Settings > liveServerSpeed.language  
3. Click **Start Live Server SE** in the status bar  
4. Choose your preferred view (browser or WebView)  
5. Edit your files — the page reloads automatically after one second 💨  
6. (Optional) Configure a keyboard shortcut to restart the server instantly  

---

## 📦 Installation

Install from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Lololegeek.live-server-speed-edition)  
Or via CLI:

bash : 
code --install-extension Lololegeek.live-server-speed-edition


---

## 🛠️ Tech Stack

- Express  
- WebSocket  
- Chokidar  
- VS Code API  

---

## ✨ Why This Edition?

Because traditional live servers can be slow or bloated.  
This edition focuses on **speed, simplicity, native integration, and multi-language support**.  
No config files. No clutter. Just fast results.  

Experimental:  
- HTTPS support  

---

## 📸 Demo

*(Ajoute ici un GIF ou une capture d’écran montrant le live reload ou le QR code — ça attire beaucoup l’œil !)*

---

## 👨‍💻 Author

Created with ❤️ by **Lololegeek**  
Want to contribute or suggest a feature? `https://github.com/Lololegeek/live-server-speed-edition/issues` or submit a PR!  



