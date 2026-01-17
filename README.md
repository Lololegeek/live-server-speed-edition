# 🚀 Live Server Speed Edition 

Version : 1.2.8

[![Installs](https://img.shields.io/visual-studio-marketplace/i/Lololegeek.live-server-speed-edition?label=Installs)](https://marketplace.visualstudio.com/items?itemName=Lololegeek.live-server-speed-edition)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/Lololegeek.live-server-speed-edition?label=Rating)](https://marketplace.visualstudio.com/items?itemName=Lololegeek.live-server-speed-edition)
[![License](https://img.shields.io/github/license/Lololegeek/live-server-speed-edition)](LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/Lololegeek/live-server-speed-edition)](https://github.com/Lololegeek/live-server-speed-edition/issues)

A blazing-fast local HTTP server with live reload — built right into VS Code.

---

### 🔄 Live Reload in Action
![Live Reload Demo](https://raw.githubusercontent.com/Lololegeek/live-server-speed-edition/main/reload.gif)

## ⚡ Features

- **One-click server launch** from the status bar  
- **Instant live reload** using WebSocket and Chokidar  
- **QR Code for mobile access**: Display QR codes directly in WebView to quickly access your server from mobile devices on the local network  
- **Multiple preview modes**:  
  - 🌐 Open in default browser  
  - 🧩 View directly inside VS Code via WebView  
  - ⚡ Instant Preview (without server)  
- **Protocol support**: HTTP and HTTPS (with self-signed certificates support)  
- **HTTPS in WebView**: No HTTPS support in VS Code WebView (no certificats)
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
This Live Server is faster and less bloated than traditional live servers. (Five Server, Live Server and more...)

Experimental:  
- HTTPS support  

---

## 📸 Demo

### 🎬 Setup & Configuration
![Setup Demo](https://raw.githubusercontent.com/Lololegeek/live-server-speed-edition/main/setup.gif)

### 🔄 Live Reload in Action
![Live Reload Demo](https://raw.githubusercontent.com/Lololegeek/live-server-speed-edition/main/reload.gif)

### ⚡ Instant Reload Feature
![Instant Reload Demo](https://raw.githubusercontent.com/Lololegeek/live-server-speed-edition/main/instantreload.gif)


---

## 👨‍💻 Author

Created with ❤️ by **Lololegeek**  
Want to contribute or suggest a feature? `https://github.com/Lololegeek/live-server-speed-edition/issues` or submit a PR!  
Thank you !
I'm a passioned développer, i'm the founder of ByteCode-Team, the fonder of ByteCode IDE, Todo In VS Code, Python HTTP Server and more... View other projects in my GitHub : https://github.com/Lololegeek



