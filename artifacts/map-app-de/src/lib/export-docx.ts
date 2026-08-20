/**
 * Word (.docx) export — uses docx v9.
 *
 * Fixed v9 shading requirement: `color` must be present alongside `fill`.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
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

type CellState = Record<string, string[]>;

// ── Page geometry (A4 landscape, 1.5 cm margins) ─────────────────────────────
const PAGE_W   = 15138; // twips of usable width  (16838 − 2×850)
const PAGE_H   = 11906;
const MARGIN   = 850;   // twips ≈ 1.5 cm

// ── Colour palette (hex without #) ───────────────────────────────────────────
const WHITE     = 'FFFFFF';
const BLACK     = '000000';
const DARK_GREY = '374151';   // section headers bg
const MID_GREY  = 'D1D5DB';   // column header bg
const LITE_GREY = 'F3F4F6';   // subgroup rows & element rows
const BORDER_C  = '9CA3AF';   // cell border colour

// ── Helpers ───────────────────────────────────────────────────────────────────

const borderSide = { style: BorderStyle.SINGLE, size: 6, color: BORDER_C } as const;
const tableBorders = {
  top:     borderSide,
  bottom:  borderSide,
  left:    borderSide,
  right:   borderSide,
  insideHorizontal: borderSide,
  insideVertical: borderSide,
};

function para(text: string, opts: { bold?: boolean; italic?: boolean; color?: string; size?: number } = {}) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text,
        bold:    opts.bold    ?? false,
        italics: opts.italic  ?? false,
        color:   opts.color   ?? BLACK,
        size:    opts.size    ?? 20,          // 20 half-pts = 10 pt
        font:    'Calibri',
      }),
    ],
  });
}

/** Full-width spanning cell. */
function spanCell(text: string, colSpan: number, opts: {
  fill?: string; bold?: boolean; italic?: boolean; textColor?: string;
} = {}) {
  const fill = opts.fill ?? WHITE;
  return new TableCell({
    columnSpan: colSpan,
    verticalAlign: VerticalAlign.CENTER,
    shading: fill !== WHITE
      ? { type: ShadingType.SOLID, fill, color: fill }   // v9: color required
      : undefined,
    children: [
      para(text, { bold: opts.bold, italic: opts.italic, color: opts.textColor ?? BLACK }),
    ],
  });
}

/** Single data cell with explicit width. */
function dataCell(text: string, width: number, opts: { bold?: boolean; fill?: string } = {}) {
  const fill = opts.fill ?? WHITE;
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    shading: fill !== WHITE
      ? { type: ShadingType.SOLID, fill, color: fill }
      : undefined,
    children: [
      para(text, { bold: opts.bold }),
    ],
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function exportToWord(
  unit: UnitOfCompetency,
  numTasks: number,
  headers: string[],
  cells: CellState,
  docTitle: string,
): Promise<void> {
  const colCount   = numTasks + 1;
  const criteriaW  = Math.round(PAGE_W * 0.36);
  const assessW    = Math.round((PAGE_W - criteriaW) / numTasks);
  const rows       = buildRows(unit);
  const tableRows: TableRow[] = [];

  // ── Application banner ────────────────────────────────────────────────────
  if (unit.description) {
    tableRows.push(new TableRow({
      children: [
        spanCell(`Application:  ${unit.description}`, colCount, {
          fill: DARK_GREY, textColor: WHITE,
        }),
      ],
    }));
  }

  // ── Column header row ─────────────────────────────────────────────────────
  tableRows.push(new TableRow({
    tableHeader: true,
    height: { value: 480, rule: HeightRule.ATLEAST },
    children: [
      dataCell('Performance Criteria / Requirement', criteriaW, { bold: true, fill: MID_GREY }),
      ...Array.from({ length: numTasks }, (_, i) =>
        dataCell(headers[i] ?? `Assessment ${i + 1}`, assessW, { bold: true, fill: MID_GREY }),
      ),
    ],
  }));

  // ── Content rows ──────────────────────────────────────────────────────────
  for (const row of rows) {
    if (row.kind === 'span') {
      let fill      = LITE_GREY;
      let bold      = false;
      let italic    = false;
      let textColor = BLACK;

      if (row.style === 'element') {
        fill = LITE_GREY; bold = true;
      } else if (row.style === 'section') {
        fill = DARK_GREY; bold = true; textColor = WHITE;
      } else {
        fill = WHITE; italic = true;   // subgroup: plain white, italic
      }

      tableRows.push(new TableRow({
        children: [spanCell(row.label, colCount, { fill, bold, italic, textColor })],
      }));
    } else {
      const saved = cells[row.key] ?? [];
      tableRows.push(new TableRow({
        children: [
          dataCell(row.label, criteriaW),
          ...Array.from({ length: numTasks }, (_, i) =>
            dataCell(saved[i] ?? '', assessW),
          ),
        ],
      }));
    }
  }

  // ── Build document ────────────────────────────────────────────────────────
  const heading = docTitle || `${unit.code} — ${unit.title}`;

  const doc = new Document({
    creator:     'RPL Companion',
    description: 'VET Competency Mapping Matrix',
    sections: [{
      properties: {
        page: {
          size: {
            orientation: PageOrientation.LANDSCAPE,
            width:  16838,
            height: PAGE_H,
          },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children: [
        // Title
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: heading, bold: true, size: 28, font: 'Calibri' })],
        }),
        // Subtitle
        new Paragraph({
          spacing: { after: 240 },
          children: [
            new TextRun({
              text: `${unit.code}  ·  ${unit.title}  ·  ${numTasks} assessment task${numTasks !== 1 ? 's' : ''}`,
              size: 18, color: '555555', font: 'Calibri',
            }),
          ],
        }),
        // Mapping table
        new Table({
          width: { size: PAGE_W, type: WidthType.DXA },
          borders: tableBorders,
          rows: tableRows,
        }),
      ],
    }],
  });

  const blob     = await Packer.toBlob(doc);
  const safeName = (docTitle || unit.code).replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50);
  saveAs(blob, `${unit.code}_mapping_${safeName}.docx`);
}
