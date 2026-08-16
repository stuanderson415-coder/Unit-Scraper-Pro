import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, BorderStyle, ShadingType, VerticalAlign,
  HeightRule, PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { buildRows } from './unit-rows';

type CellState = Record<string, string[]>;

// ── Measurements (A4 landscape with 1.5cm margins) ──────────────────────────
// A4 landscape: 16838 twips wide; margins 2 × 850 = 1700; content ≈ 15138
const PAGE_W = 15138;

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  white:      'FFFFFF',
  black:      '000000',
  darkGrey:   '374151',  // section headers
  medGrey:    'D1D5DB',  // header row bg
  lightGrey:  'F3F4F6',  // subgroup rows
  elemGrey:   'E5E7EB',  // element rows
};

// ── Border helper ─────────────────────────────────────────────────────────────
const border = (size = 6, color = '9CA3AF') => ({
  top:    { style: BorderStyle.SINGLE, size, color },
  bottom: { style: BorderStyle.SINGLE, size, color },
  left:   { style: BorderStyle.SINGLE, size, color },
  right:  { style: BorderStyle.SINGLE, size, color },
});

// ── Cell helpers ──────────────────────────────────────────────────────────────
function spanCell(
  text: string,
  colSpan: number,
  opts: { bold?: boolean; italic?: boolean; fill?: string; textColor?: string; fontSize?: number } = {},
): TableCell {
  const { bold = false, italic = false, fill = C.white, textColor = C.black, fontSize = 20 } = opts;
  return new TableCell({
    columnSpan: colSpan,
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: border(),
    shading: fill !== C.white ? { type: ShadingType.SOLID, fill } : undefined,
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, bold, italics: italic, color: textColor, size: fontSize }),
        ],
      }),
    ],
  });
}

function dataCell(text: string, width: number, opts: { bold?: boolean } = {}): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: border(),
    verticalAlign: VerticalAlign.TOP,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold ?? false, size: 18 })],
      }),
    ],
  });
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function exportToWord(
  unit: UnitOfCompetency,
  numTasks: number,
  headers: string[],
  cells: CellState,
  docTitle: string,
): Promise<void> {
  const colCount = numTasks + 1;
  const criteriaW = Math.round(PAGE_W * 0.34);
  const assessW   = Math.round((PAGE_W - criteriaW) / numTasks);

  const rows = buildRows(unit);
  const tableRows: TableRow[] = [];

  // ── Application row ────────────────────────────────────────────────────────
  if (unit.description) {
    tableRows.push(new TableRow({
      children: [
        spanCell(`Application: ${unit.description}`, colCount, {
          fill: C.darkGrey, textColor: C.white, bold: false, fontSize: 18,
        }),
      ],
    }));
  }

  // ── Column header row ──────────────────────────────────────────────────────
  tableRows.push(new TableRow({
    tableHeader: true,
    height: { value: 500, rule: HeightRule.ATLEAST },
    children: [
      dataCell('Performance Criteria / Requirement', criteriaW, { bold: true }),
      ...Array.from({ length: numTasks }, (_, i) =>
        dataCell(headers[i] ?? `Assessment ${i + 1}`, assessW, { bold: true }),
      ),
    ],
  }));

  // ── Content rows ───────────────────────────────────────────────────────────
  for (const row of rows) {
    if (row.kind === 'span') {
      let fill = C.white;
      let bold = false;
      let italic = false;
      let textColor = C.black;

      if (row.style === 'element') {
        fill = C.elemGrey; bold = true;
      } else if (row.style === 'section') {
        fill = C.darkGrey; bold = true; textColor = C.white;
      } else {
        fill = C.lightGrey; italic = true;
      }

      tableRows.push(new TableRow({
        children: [spanCell(row.label, colCount, { fill, bold, italic, textColor, fontSize: 18 })],
      }));
    } else {
      const cellValues = cells[row.key] ?? [];
      tableRows.push(new TableRow({
        children: [
          dataCell(row.label, criteriaW),
          ...Array.from({ length: numTasks }, (_, i) =>
            dataCell(cellValues[i] ?? '', assessW),
          ),
        ],
      }));
    }
  }

  // ── Build document ─────────────────────────────────────────────────────────
  const heading = docTitle || `${unit.code} — ${unit.title}`;

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
            width: 16838,
            height: 11906,
          },
          margin: { top: 850, bottom: 850, left: 850, right: 850 },
        },
      },
      children: [
        // Document title
        new Paragraph({
          children: [new TextRun({ text: heading, bold: true, size: 28 })],
          spacing: { after: 200 },
        }),
        // Subtitle
        new Paragraph({
          children: [
            new TextRun({
              text: `Unit: ${unit.code}  |  ${unit.title}  |  ${numTasks} assessment task${numTasks !== 1 ? 's' : ''}`,
              size: 20, color: '555555',
            }),
          ],
          spacing: { after: 300 },
        }),
        // The mapping table
        new Table({
          width: { size: PAGE_W, type: WidthType.DXA },
          rows: tableRows,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${unit.code}_mapping${docTitle ? `_${docTitle.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}` : ''}.docx`;
  saveAs(blob, filename);
}
