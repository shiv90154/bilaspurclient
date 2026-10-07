import type { Response } from 'express';

export type CsvCell = string | number | boolean | Date | null | undefined;

/**
 * Text cells starting with these make Excel run them as a formula ("=HYPERLINK(...)"), so a
 * student who types one into a doubt or name could attack whoever opens the export.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/**
 * Sends a CSV download. The BOM makes Excel read UTF-8 (Hindi names) correctly.
 * `name` is used without a date; today's date is appended.
 */
export function sendCsv(res: Response, name: string, header: string[], rows: CsvCell[][]): void {
  const day = new Date().toISOString().slice(0, 10);
  const file = `${name.replace(/[^\w-]+/g, '-')}-${day}.csv`;
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${file}"`,
    'Cache-Control': 'private, no-store',
  });
  res.send('﻿' + toCsv(header, rows));
}

/** Calendar date (yyyy-mm-dd) in India time, for CSV columns people read. */
export function istDate(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/** Date and time (yyyy-mm-dd hh:mm) in India time. */
export function istDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
}
