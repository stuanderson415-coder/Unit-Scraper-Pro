import { saveAs } from 'file-saver';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { buildRows } from './unit-rows';
import { evidenceCode, type RplRecord } from './rpl-state';

const esc = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const CSS = `
@page Section1 {
  size: 11in 8.5in;
  margin: 1.27cm 1.27cm 1.27cm 1.27cm;
  mso-header-margin: 0.5in;
  mso-footer-margin: 0.5in;
  mso-header: h1;
  mso-footer: f1;
}
div.Section1 { page: Section1; }
body { font-family: Calibri, sans-serif; font-size: 10pt; }
table { border-collapse: collapse; width: 100%; margin: 5pt 0; }
th, td { border: 1px solid #000; padding: 6px; vertical-align: top; text-align: left; }
th { background-color: #f0f0f0; font-weight: bold; }
h1 { font-size: 16pt; margin: 3pt 0; padding: 0; }
h2 { font-size: 13pt; margin: 12pt 0 3pt; padding: 0; }
p { margin: 3pt 0; padding: 0; }
.small { font-size: 8.5pt; }
.section { background-color: #f0f0f0; font-weight: bold; }
.signature { height: 72pt; }
`.trim();

function mappingRows(unit: UnitOfCompetency, record: RplRecord) {
  const evidenceById = new Map(record.evidence.map((item, index) => [item.id, { ...item, code: evidenceCode(index) }]));
  return buildRows(unit).map(row => {
    if (row.kind === 'span') {
      return `<tr><td colspan="3" class="section">${esc(row.label)}</td></tr>`;
    }
    const linked = (record.mappings[row.key] ?? [])
      .map(id => evidenceById.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const interview = record.interviews[row.key];
    const coverage = linked.length
      ? linked.map(item => `<p><strong>${esc(item.code)}</strong> — ${esc(item.title)}</p>`).join('')
      : 'No direct evidence mapped';
    const gap = interview
      ? `<strong>${interview.outcome === 'resolved' ? 'Resolved' : interview.outcome === 'not-resolved' ? 'Not resolved' : 'Pending'}</strong>${interview.question ? `<br>${esc(interview.question)}` : ''}`
      : linked.length ? '—' : 'Gap to address';
    return `<tr><td>${esc(row.label)}</td><td>${coverage}</td><td>${gap}</td></tr>`;
  }).join('\n');
}

function evidenceRows(record: RplRecord) {
  if (!record.evidence.length) return '<tr><td colspan="3">No evidence items logged.</td></tr>';
  return record.evidence.map((item, index) => `<tr>
<td>${evidenceCode(index)}</td>
<td><strong>${esc(item.title)}</strong>${item.reference ? `<br><span class="small">${esc(item.reference)}</span>` : ''}</td>
<td>${esc(item.notes) || '&nbsp;'}</td>
</tr>`).join('\n');
}

function interviewRows(unit: UnitOfCompetency, record: RplRecord) {
  const labels = new Map(buildRows(unit).filter((row): row is Extract<typeof row, { kind: 'data' }> => row.kind === 'data').map(row => [row.key, row.label]));
  const entries = Object.entries(record.interviews).filter(([, value]) =>
    value.question || value.studentResponse || value.assessorNotes || value.outcome !== 'pending',
  );
  if (!entries.length) return '<tr><td colspan="4">No interview or oral-question records were added.</td></tr>';
  return entries.map(([rowKey, item]) => `<tr>
<td>${esc(labels.get(rowKey) ?? rowKey)}</td>
<td>${esc(item.question) || '&nbsp;'}</td>
<td>${esc(item.studentResponse) || '&nbsp;'}</td>
<td><strong>${esc(item.outcome)}</strong>${item.assessorNotes ? `<br>${esc(item.assessorNotes)}` : ''}</td>
</tr>`).join('\n');
}

export function exportRplToWord(unit: UnitOfCompetency, record: RplRecord) {
  const today = new Date().toLocaleDateString('en-AU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>${CSS}</style></head>
<body><div class="Section1">
<div style="mso-element:header" id="h1"><p>${esc(unit.code)} ${esc(unit.title)} | RPL Mapping</p></div>
<div style="mso-element:footer" id="f1"><p>Published ${today} | RPL Mapping | Page <span style="mso-field-code:'PAGE'">1</span> of <span style="mso-field-code:'NUMPAGES'">1</span></p></div>
<h1 style="page-break-before:avoid">Recognition of Prior Learning Mapping</h1>
<table>
<tr><th style="width:32%">Unit of competency</th><td>${esc(unit.code)} ${esc(unit.title)}</td></tr>
<tr><th>Student name</th><td>${esc(record.student.name) || '&nbsp;'}</td></tr>
<tr><th>Student number</th><td>${esc(record.student.studentNumber) || '&nbsp;'}</td></tr>
<tr><th>Assessment date</th><td>${today}</td></tr>
</table>
<h2>Evidence log</h2>
<table><tr><th style="width:10%">Code</th><th style="width:32%">Evidence piece</th><th>Reference / assessor notes</th></tr>
${evidenceRows(record)}</table>
<h2>RPL evidence mapping</h2>
<table><tr><th style="width:46%">Competency requirement</th><th style="width:32%">Evidence mapped</th><th>Gap / interview outcome</th></tr>
${mappingRows(unit, record)}</table>
<h2>Interview and oral-question record</h2>
<table><tr><th style="width:34%">Requirement</th><th style="width:24%">Question / prompt</th><th style="width:24%">Student response</th><th>Assessor outcome / notes</th></tr>
${interviewRows(unit, record)}</table>
<h2>Signatures</h2>
<table>
<tr><th style="width:50%">Student declaration</th><th>Assessor declaration</th></tr>
<tr><td class="signature">I confirm the evidence and responses provided are my own.<br><br><br>Signature: ____________________________________<br>Date: ________________________________________</td>
<td class="signature">I confirm this RPL assessment has been reviewed against the unit requirements.<br><br><br>Signature: ____________________________________<br>Name: ________________________________________<br>Date: ________________________________________</td></tr>
</table>
</div></body></html>`;

  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  const safeStudent = (record.student.studentNumber || record.student.name || 'student')
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 32);
  saveAs(blob, `${unit.code}_RPL_mapping_${safeStudent}.doc`);
}