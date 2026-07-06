export function formatDistanceToNowStrict(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "instantes";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} mês${mo > 1 ? "es" : ""}`;
  const y = Math.floor(mo / 12);
  return `${y} ano${y > 1 ? "s" : ""}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function maskId(id: string): string {
  if (!id) return "";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}