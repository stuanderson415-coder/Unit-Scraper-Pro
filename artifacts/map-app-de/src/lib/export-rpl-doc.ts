import {
  AlignmentType,
  BorderStyle,
  Document,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { buildRows } from './unit-rows';
import { EVIDENCE_TYPES, evidenceCode, studentDisplayName, type RplRecord } from './rpl-state';

const PAGE_WIDTH = 15138;
const MARGIN = 720;
const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' } as const;
const BORDERS = {
  top: BORDER,
  bottom: BORDER,
  left: BORDER,
  right: BORDER,
  insideHorizontal: BORDER,
  insideVertical: BORDER,
};

function textParagraph(text: string, options: { bold?: boolean; size?: number; color?: string; after?: number } = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? 40 },
    children: [new TextRun({
      text: text || ' ',
      bold: options.bold,
      size: options.size ?? 18,
      color: options.color ?? '0F172A',
      font: 'Calibri',
    })],
  });
}

function cell(text: string, width?: number, options: { bold?: boolean; fill?: string; color?: string; span?: number } = {}) {
  const fill = options.fill ?? 'FFFFFF';
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    columnSpan: options.span,
    verticalAlign: VerticalAlign.TOP,
    shading: fill !== 'FFFFFF' ? { type: ShadingType.SOLID, fill, color: fill } : undefined,
    margins: { top: 90, bottom: 90, left: 100, right: 100 },
    children: [textParagraph(text, { bold: options.bold, color: options.color })],
  });
}

function table(rows: TableRow[], widths?: number[]) {
  return new Table({
    width: { size: PAGE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders: BORDERS,
    rows,
  });
}

function heading(text: string) {
  return new Paragraph({
    spacing: { before: 220, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, color: '115E59', font: 'Calibri' })],
  });
}

function formatDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function outcomeLabel(outcome: RplRecord['finalisation']['outcome']) {
  if (outcome === 'full-rpl') return 'Full RPL granted';
  if (outcome === 'partial-rpl') return 'Partial RPL granted';
  if (outcome === 'not-granted') return 'RPL not granted';
  return 'Decision pending';
}

export async function exportRplToWord(unit: UnitOfCompetency, record: RplRecord) {
  const detailWidths = [4000, PAGE_WIDTH - 4000];
  const details = [
    ['Unit of competency', `${unit.code} ${unit.title}`],
    ['Student name', studentDisplayName(record.student)],
    ['Student number', record.student.studentNumber],
    ['Trainer / assessor', record.student.trainerName],
    ['Parent Qualification', record.student.organisation],
    ['Assessment date', formatDate(record.student.assessmentDate)],
    ['RPL outcome', outcomeLabel(record.finalisation.outcome)],
    ['Outcome notes / conditions', record.finalisation.outcomeNotes],
  ];

  const evidenceWidths = [1200, 2500, 3100, PAGE_WIDTH - 6800];
  const evidenceRows = record.evidence.length
    ? record.evidence.map((item, index) => new TableRow({
      children: [
        cell(evidenceCode(index), evidenceWidths[0]),
        cell(EVIDENCE_TYPES.find(type => type.value === item.type)?.name ?? 'Reports', evidenceWidths[1]),
        cell(`${item.title}${item.reference ? `\n${item.reference}` : ''}`, evidenceWidths[2]),
        cell(item.notes, evidenceWidths[3]),
      ],
    }))
    : [new TableRow({ children: [cell('No evidence items logged.', undefined, { span: 4 })] })];

  const mappingWidths = [7000, 4400, PAGE_WIDTH - 11400];
  const evidenceById = new Map(record.evidence.map((item, index) => [item.id, `${evidenceCode(index)} — ${item.title}`]));
  const mappingRows = buildRows(unit).map(row => {
    if (row.kind === 'span') {
      const isSection = row.style === 'section';
      return new TableRow({
        children: [cell(row.label, undefined, {
          span: 3,
          bold: row.style !== 'subgroup',
          fill: isSection ? '0F766E' : row.style === 'element' ? 'E2E8F0' : 'F8FAFC',
          color: isSection ? 'FFFFFF' : '0F172A',
        })],
      });
    }
    const mapped = (record.mappings[row.key] ?? []).map(id => evidenceById.get(id)).filter(Boolean).join('\n');
    const interview = record.interviews[row.key];
    const outcome = mapped
      ? 'Direct evidence mapped'
      : interview
        ? `${interview.outcome === 'not-resolved' ? 'Not resolved' : interview.outcome === 'resolved' ? 'Resolved' : 'Pending'}${interview.question ? `\n${interview.question}` : ''}`
        : 'Gap to address';
    return new TableRow({
      children: [
        cell(row.label, mappingWidths[0]),
        cell(mapped || 'No direct evidence mapped', mappingWidths[1]),
        cell(outcome, mappingWidths[2]),
      ],
    });
  });

  const interviewWidths = [4900, 3400, 3400, PAGE_WIDTH - 11700];
  const labels = new Map(buildRows(unit).filter((row): row is Extract<typeof row, { kind: 'data' }> => row.kind === 'data').map(row => [row.key, row.label]));
  const interviews = Object.entries(record.interviews).filter(([, value]) =>
    value.question || value.studentResponse || value.assessorNotes || value.outcome !== 'pending',
  );
  const interviewRows = interviews.length
    ? interviews.map(([key, item]) => new TableRow({
      children: [
        cell(labels.get(key) ?? key, interviewWidths[0]),
        cell(item.question, interviewWidths[1]),
        cell(item.studentResponse, interviewWidths[2]),
        cell(`${item.outcome}\n${item.assessorNotes}`, interviewWidths[3]),
      ],
    }))
    : [new TableRow({ children: [cell('No interview or oral-question records were added.', undefined, { span: 4 })] })];

  const studentSignature = record.finalisation.studentSignature || '____________________________________';
  const assessorSignature = record.finalisation.assessorSignature || record.student.trainerName || '____________________________________';
  const studentSignatureDate = formatDate(record.finalisation.studentSignatureDate) || '________________';
  const assessorSignatureDate = formatDate(record.finalisation.assessorSignatureDate) || '________________';
  const doc = new Document({
    creator: 'RPL Companion',
    description: 'Recognition of Prior Learning assessment record',
    sections: [{
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE, width: 16838, height: 11906 },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 180 },
          children: [new TextRun({ text: 'Recognition of Prior Learning Mapping', bold: true, size: 30, color: '134E4A', font: 'Calibri' })],
        }),
        table(details.map(([label, value]) => new TableRow({ children: [cell(label, detailWidths[0], { bold: true, fill: 'E2E8F0' }), cell(value, detailWidths[1])] })), detailWidths),
        heading('Evidence log'),
        table([
          new TableRow({ tableHeader: true, children: ['Code', 'Document type', 'Evidence piece / reference', 'Assessor notes'].map((label, index) => cell(label, evidenceWidths[index], { bold: true, fill: 'CCFBF1' })) }),
          ...evidenceRows,
        ], evidenceWidths),
        heading('RPL evidence mapping'),
        table([
          new TableRow({ tableHeader: true, children: ['Competency requirement', 'Evidence mapped', 'Gap / interview outcome'].map((label, index) => cell(label, mappingWidths[index], { bold: true, fill: 'CCFBF1' })) }),
          ...mappingRows,
        ], mappingWidths),
        heading('Interview and oral-question record'),
        table([
          new TableRow({ tableHeader: true, children: ['Requirement', 'Question / prompt', 'Student response', 'Assessor outcome / notes'].map((label, index) => cell(label, interviewWidths[index], { bold: true, fill: 'CCFBF1' })) }),
          ...interviewRows,
        ], interviewWidths),
        heading('Signatures'),
        table([
          new TableRow({ children: [cell('Student declaration', PAGE_WIDTH / 2, { bold: true, fill: 'CCFBF1' }), cell('Assessor declaration', PAGE_WIDTH / 2, { bold: true, fill: 'CCFBF1' })] }),
          new TableRow({ children: [
            cell(`I confirm the evidence and responses provided are my own.\n\nDigitally signed by: ${studentSignature}\n\nDate (DD/MM/YYYY): ${studentSignatureDate}`, PAGE_WIDTH / 2),
            cell(`I confirm this RPL assessment has been reviewed and finalised against the unit requirements.\n\nDigitally signed by: ${assessorSignature}\n\nDate (DD/MM/YYYY): ${assessorSignatureDate}`, PAGE_WIDTH / 2),
          ] }),
        ], [PAGE_WIDTH / 2, PAGE_WIDTH / 2]),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeStudent = (record.student.studentNumber || studentDisplayName(record.student) || 'student')
    .replace(/[^a-z0-9_-]/gi, '_')
    .slice(0, 32);
  saveAs(blob, `${unit.code}_RPL_mapping_${safeStudent}.docx`);
}