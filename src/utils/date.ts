export function fmtDate(d: string | undefined | null): string {
  if (!d) return "—";
  // Normalize: space→T (time crate Display), trim sub-ms precision
  const normalized = d.replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export function fmtDateOnly(d: string | undefined | null): string {
  if (!d) return "—";
  const normalized = d.replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-MX", { dateStyle: "medium" });
}
