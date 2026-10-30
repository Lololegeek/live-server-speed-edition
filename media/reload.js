(() => {
  if (window.__liveServerSE) return;
  window.__liveServerSE = true;
  const key = "live-server-se:" + location.pathname;
  try {
    const state = JSON.parse(sessionStorage.getItem(key) || "null");
    if (state) {
      addEventListener("load", () => scrollTo(state.x, state.y), {
        once: true,
      });
      sessionStorage.removeItem(key);
    }
  } catch {}
  let retry = 250;
  let socket;
  function connect() {
    socket = new WebSocket(
      (location.protocol === "https:" ? "wss://" : "ws://") +
        location.host +
        "/__live_server_se/ws",
    );
    socket.onopen = () => {
      retry = 250;
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type !== "reload") return;
      if (
        message.paths.length &&
        message.paths.every((p) => p.toLowerCase().endsWith(".css"))
      ) {
        let changed = false;
        document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
          const url = new URL(link.href);
          if (url.origin === location.origin) {
            url.searchParams.set("__live_server_se", Date.now());
            link.href = url.href;
            changed = true;
          }
        });
        if (changed) return;
      }
      try {
        sessionStorage.setItem(key, JSON.stringify({ x: scrollX, y: scrollY }));
      } catch {}
      location.reload();
    };
    socket.onclose = () => {
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 5000);
    };
    socket.onerror = () => socket.close();
  }
  connect();
  if (window.__liveServerSEConsole) {
    const send = (level, message) => {
      if (socket?.readyState !== 1) return;
      try {
        socket.send(
          JSON.stringify({
            type: "console",
            level,
            message: String(message).slice(0, 4000),
          }),
        );
      } catch {}
    };
    for (const level of ["log", "info", "warn", "error"]) {
      const original = console[level].bind(console);
      console[level] = (...args) => {
        original(...args);
        send(
          level,
          args
            .map((a) => {
              try {
                return typeof a === "string" ? a : JSON.stringify(a);
              } catch {
                return String(a);
              }
            })
            .join(" "),
        );
      };
    }
    addEventListener(
      "error",
      (event) =>
        send(
          "error",
          event.message + " at " + event.filename + ":" + event.lineno,
        ),
      true,
    );
    addEventListener("unhandledrejection", (event) =>
      send("error", "Unhandled rejection: " + String(event.reason)),
    );
  }
  // Inspect links inside the VS Code iframe using HEAD only. Never request a download body.
  if (parent !== window)
    document.addEventListener(
      "click",
      async (event) => {
        const link = event.target.closest?.("a[href]");
        if (
          !link ||
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey
        )
          return;
        const url = new URL(link.href, location.href);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          (url.hash && url.pathname === location.pathname)
        )
          return;
        const explicit =
          link.hasAttribute("download") ||
          /\.(zip|7z|rar|exe|msi|tar|gz|mp3|mp4|docx?|xlsx?|pptx?|iso|dmg|apk)$/i.test(
            url.pathname,
          );
        if (url.origin !== location.origin && !explicit) return;
        event.preventDefault();
        let name =
            link.getAttribute("download") ||
            url.pathname.split("/").pop() ||
            "file",
          size,
          mime;
        let attachment = explicit;
        try {
          const response = await fetch(url, {
            method: "HEAD",
            credentials: "same-origin",
          });
          const disposition = response.headers.get("content-disposition") || "";
          attachment ||= /attachment/i.test(disposition);
          mime = response.headers.get("content-type");
          const length = response.headers.get("content-length");
          if (length !== null) size = Number(length);
          const match =
            /filename\*=UTF-8''([^;]+)|filename="([^";]+)"|filename=([^;]+)/i.exec(
              disposition,
            );
          if (match)
            name = decodeURIComponent(match[1] || match[2] || match[3]);
        } catch {}
        if (attachment)
          parent.postMessage(
            { type: "live-server-se-download", name, size, mime },
            "*",
          );
        else location.href = url.href;
      },
      true,
    );
})();
