/**
 * Copy the mapping table to the clipboard.
 *
 * Writes TWO formats simultaneously:
 *   text/html  → preserves table structure when pasted into Word / Google Docs / Outlook
 *   text/plain → tab-separated values for Excel / Numbers
 */
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { buildRows } from './unit-rows';

type CellState = Record<string, string[]>;

const esc = (s: string) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// ── HTML builder ──────────────────────────────────────────────────────────────

const STYLES = {
  table:   'border-collapse:collapse;width:100%;font-family:Calibri,sans-serif;font-size:10pt;',
  app:     'background:#374151;color:#fff;padding:6px 8px;',
  hdr:     'background:#D1D5DB;font-weight:bold;padding:5px 8px;border:1px solid #9CA3AF;text-align:left;vertical-align:top;',
  element: 'background:#E5E7EB;font-weight:bold;padding:5px 8px;border:1px solid #9CA3AF;',
  section: 'background:#374151;color:#fff;font-weight:bold;text-transform:uppercase;font-size:9pt;letter-spacing:0.05em;padding:5px 8px;border:1px solid #9CA3AF;',
  subgrp:  'background:#fff;font-style:italic;color:#6B7280;padding:4px 8px;border:1px solid #D1D5DB;',
  data:    'background:#fff;padding:5px 8px;border:1px solid #D1D5DB;vertical-align:top;',
};

function td(content: string, style: string, extra = '') {
  return `<td style="${style}"${extra}>${esc(content)}</td>`;
}
function th(content: string, style: string) {
  return `<th style="${style}">${esc(content)}</th>`;
}

function taskLabel(headers: string[], i: number) {
  return (headers[i] && headers[i].trim()) ? headers[i].trim() : `Task ${i + 1}`;
}

function buildHtml(
  unit: UnitOfCompetency,
  numTasks: number,
  headers: string[],
  cells: CellState,
): string {
  const rows = buildRows(unit);
  const cols = numTasks + 1;
  const span = `colspan="${cols}"`;
  const lines: string[] = [`<table style="${STYLES.table}">`];

  // ── Column headers first — paste targets (Word/Docs) need thead at top ──
  lines.push('<thead><tr>');
  lines.push(th('Performance Criteria / Requirement', STYLES.hdr));
  for (let i = 0; i < numTasks; i++) {
    lines.push(th(taskLabel(headers, i), STYLES.hdr));
  }
  lines.push('</tr></thead><tbody>');

  // Application banner inside tbody (doesn't interfere with column sizing)
  if (unit.description) {
    lines.push(`<tr>${td('Application: ' + unit.description, STYLES.app, ` ${span}`)}</tr>`);
  }

  // Content rows
  for (const row of rows) {
    if (row.kind === 'span') {
      const style =
        row.style === 'element' ? STYLES.element :
        row.style === 'section' ? STYLES.section :
        STYLES.subgrp;
      lines.push(`<tr>${td(row.label, style, ` ${span}`)}</tr>`);
    } else {
      const saved = cells[row.key] ?? [];
      lines.push('<tr>');
      lines.push(td(row.label, STYLES.data));
      for (let i = 0; i < numTasks; i++) {
        lines.push(td(saved[i] ?? '', STYLES.data));
      }
      lines.push('</tr>');
    }
  }

  lines.push('</tbody></table>');
  return lines.join('');
}

// ── TSV builder (for Excel / Numbers) ────────────────────────────────────────

function buildTsv(
  unit: UnitOfCompetency,
  numTasks: number,
  headers: string[],
  cells: CellState,
): string {
  const rows = buildRows(unit);
  const clean = (s: string) => s.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');

  // Always generate exactly numTasks header columns
  const taskHeaders = Array.from({ length: numTasks }, (_, i) => taskLabel(headers, i));
  const lines: string[] = [];

  // Header row first
  lines.push(['Performance Criteria / Requirement', ...taskHeaders].map(clean).join('\t'));

  if (unit.description) {
    lines.push([`Application: ${unit.description}`, ...Array(numTasks).fill('')].map(clean).join('\t'));
  }

  for (const row of rows) {
    if (row.kind === 'span') {
      lines.push([clean(row.label), ...Array(numTasks).fill('')].join('\t'));
    } else {
      const saved = cells[row.key] ?? [];
      const cols  = [clean(row.label), ...Array.from({ length: numTasks }, (_, i) => clean(saved[i] ?? ''))];
      lines.push(cols.join('\t'));
    }
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function copyTableToClipboard(
  unit: UnitOfCompetency,
  numTasks: number,
  headers: string[],
  cells: CellState,
): Promise<void> {
  const html = buildHtml(unit, numTasks, headers, cells);
  const tsv  = buildTsv(unit, numTasks, headers, cells);

  if (navigator.clipboard && window.ClipboardItem) {
    // Modern API — copies both formats; paste target picks what it can use
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([tsv],  { type: 'text/plain' }),
      }),
    ]);
  } else {
    // Fallback — plain text only
    await navigator.clipboard.writeText(tsv);
  }
}
