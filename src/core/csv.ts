/** RFC 4180: comillas dobles alrededor de campos con separador, comillas o saltos de línea. */
export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV<T>(rows: readonly T[], columns: readonly { header: string; value: (row: T) => unknown }[]): string {
  const head = columns.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => csvEscape(c.value(r))).join(','));
  return [head, ...body].join('\n');
}
