export interface VisibilitySettings {
  mode: string;
  start: boolean;
  qr: boolean;
  reopen: boolean;
  copy: boolean;
}
export function buttonVisibility(
  settings: VisibilitySettings,
  active: boolean,
) {
  const full = settings.mode !== "lite";
  return {
    start: settings.start,
    qr: full && active && settings.qr,
    reopen: full && active && settings.reopen,
    copy: full && active && settings.copy,
  };
}
