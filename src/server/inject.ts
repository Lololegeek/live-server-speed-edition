export function inject(html: string): string {
  if (html.includes('src="/__live_server_se/client.js"')) return html;
  const script = '<script src="/__live_server_se/client.js" defer></script>';
  return /<\/body\s*>/i.test(html)
    ? html.replace(/<\/body\s*>/i, script + "</body>")
    : html + script;
}
