/**
 * Word export — generates a Word-compatible HTML file (.doc).
 *
 * The template supplied by the user is itself Word HTML, so we match its
 * exact structure rather than fighting with docx.js shading / border APIs.
 *
 * Portrait A4 (8.5 × 11 in), 1.27 cm margins, Calibri 11 pt, black borders,
 * #f0f0f0 grey for section-header rows and <th> cells.
 */
import { saveAs } from 'file-saver';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { buildRows } from './unit-rows';

type CellState = Record<string, string[]>;

// ── HTML helpers ──────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert plain text with newlines into <p> tags. */
function textToParas(text: string): string {
  return text
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${esc(line)}</p>`)
    .join('\n');
}

// ── CSS (matches the template exactly) ───────────────────────────────────────

const CSS = `
@page Section1 {
  size: 8.5in 11in;
  margin: 1.27cm 1.27cm 1.27cm 1.27cm;
  mso-header-margin: 0.5in;
  mso-footer-margin: 0.5in;
  mso-header: h1;
  mso-footer: f1;
}
div.Section1 { page: Section1; }
body { font-family: Calibri, sans-serif; font-size: 11pt; }
table { border-collapse: collapse; width: 100%; margin: 3pt 0; }
th, td { border: 1px solid #000; padding: 8px; vertical-align: top; text-align: left; }
td p { margin: 0; padding: 0; }
th { background-color: #f0f0f0; font-weight: bold; }
h1 { font-size: 16pt; margin: 3pt 0; padding: 0; }
h2 { font-size: 14pt; margin: 3pt 0; padding: 0; }
p { margin: 3pt 0; padding: 0; }
.description { margin: 3pt 0; padding: 0; }
`.trim();

// ── Table row builders ────────────────────────────────────────────────────────

const GREY = 'background-color:#f0f0f0';

/** Section-header row — grey across ALL columns */
function sectionRow(label: string, n: number): string {
  const taskCells = Array(n).fill(`<td style="${GREY}">&nbsp;</td>`).join('');
  return `<tr>
  <td style="${GREY}"><strong>${esc(label)}</strong></td>${taskCells}
</tr>`;
}

/** Element row — bold in first cell, empty (white) task cells */
function elementRow(label: string, n: number): string {
  const taskCells = Array(n).fill('<td>&nbsp;</td>').join('');
  return `<tr>
  <td><strong>${esc(label)}</strong></td>${taskCells}
</tr>`;
}

/** Subgroup row — italic in first cell, empty task cells */
function subgroupRow(label: string, n: number): string {
  const taskCells = Array(n).fill('<td>&nbsp;</td>').join('');
  return `<tr>
  <td><em><strong>${esc(label)}</strong></em></td>${taskCells}
</tr>`;
}

/** Data row — criteria text + task cells (with saved content if any) */
function dataRow(label: string, taskValues: string[]): string {
  const taskCells = taskValues
    .map(v => v.trim() ? `<td><p>${esc(v)}</p></td>` : '<td>&nbsp;</td>')
    .join('');
  return `<tr>
  <td>${esc(label)}</td>${taskCells}
</tr>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function exportToWord(
  unit: UnitOfCompetency,
  numTasks: number,
  headers: string[],
  cells: CellState,
  docTitle: string,
): void {
  const rows = buildRows(unit);

  // Task column headers
  const taskHeaders = Array.from({ length: numTasks }, (_, i) =>
    (headers[i] && headers[i].trim()) ? headers[i].trim() : `Task ${i + 1}`,
  );

  // Column widths: 52% criteria, remaining split equally
  const criteriaW = 52;
  const taskW     = Math.floor(48 / numTasks);

  const thCols = taskHeaders
    .map(h => `<th style="width:${taskW}%">${esc(h)}</th>`)
    .join('');

  // Build mapping table rows
  const tableRows = rows.map(row => {
    if (row.kind === 'span') {
      if (row.style === 'section')  return sectionRow(row.label, numTasks);
      if (row.style === 'element')  return elementRow(row.label, numTasks);
      if (row.style === 'subgroup') return subgroupRow(row.label, numTasks);
    }
    // data row
    const saved = cells[row.key] ?? [];
    const vals  = Array.from({ length: numTasks }, (_, i) => saved[i] ?? '');
    return dataRow(row.label, vals);
  }).join('\n');

  // Info table first-cell content
  const competencyCell = docTitle && docTitle.trim()
    ? esc(docTitle)
    : `${esc(unit.code)} ${esc(unit.title)}`;

  // Application paragraphs
  const appHtml = unit.description ? textToParas(unit.description) : '';

  const today = new Date().toLocaleDateString('en-AU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>${CSS}</style>
</head>
<body>
<div class="Section1">

<div class="header" style="mso-element:header" id=h1>
<p>${esc(unit.code)} ${esc(unit.title)}</p>
</div>
<div class="footer" style="mso-element:footer" id=f1>
<p>Published ${today} | Mapping</p>
<p>Page <span style="mso-field-code:'PAGE'">1</span> of <span style="mso-field-code:'NUMPAGES'">1</span></p>
</div>

<h1 style="page-break-before:avoid">Assessment Mapping: ${esc(unit.code)} ${esc(unit.title)}</h1>

<table>
<tr>
  <td style="${GREY};width:40%"><strong>Competency Title, Code and Banner Code (List All if Clustered):</strong></td>
  <td>${competencyCell}</td>
</tr>
<tr>
  <td style="${GREY}"><strong>List All Current Programs including this Competency:</strong></td>
  <td>&nbsp;</td>
</tr>
<tr>
  <td style="${GREY}"><strong>Teacher Name and Date:</strong></td>
  <td>&nbsp;</td>
</tr>
</table>

<h2>Application</h2>
${appHtml}

<h2>Elements and performance criteria</h2>
<div class="description">
<p><strong>Elements</strong> define the essential outcomes.</p>
<p><strong>Performance criteria</strong> describe the performance needed to demonstrate achievement of the element.</p>
</div>

<table>
<tr>
  <th style="width:${criteriaW}%">Criteria</th>${thCols}
</tr>
${tableRows}
</table>

</div>
</body>
</html>`;

  const blob     = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const safeName = unit.code.replace(/[^a-z0-9_\-]/gi, '_');
  saveAs(blob, `${safeName}_mapping.doc`);
}
