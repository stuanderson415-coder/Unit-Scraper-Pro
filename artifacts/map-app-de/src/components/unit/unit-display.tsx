import { useState, useEffect, useRef, useCallback } from 'react';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

const NUM_TASKS = 5;

// ── Persistence ────────────────────────────────────────────────────────────────

type CellState   = Record<string, string[]>; // rowKey → one string per assessment column
type HeaderState = string[];                  // one label per assessment column

const cellKey   = (code: string) => `map-app-de:cells:${code}`;
const headerKey = (code: string) => `map-app-de:headers:${code}`;

const defaultHeaders = () =>
  Array.from({ length: NUM_TASKS }, (_, i) => `Assessment ${i + 1}`);

function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback();
  } catch { return fallback(); }
}
function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

// ── Auto-resize textarea ───────────────────────────────────────────────────────

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

function CellInput({ value, onChange, placeholder, className = '' }: InputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 28) + 'px';
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      className={`w-full resize-none overflow-hidden bg-transparent border-0 focus:outline-none focus:ring-0 leading-snug placeholder:text-gray-300 ${className}`}
    />
  );
}

// ── Row model ──────────────────────────────────────────────────────────────────
//
// span     – full-width spanning row (section header, element heading, sub-group label)
// data     – descriptor in col-1 + editable cells in assessment columns
//

type SpanRow = {
  kind:  'span';
  key:   string;
  label: string;
  style: 'element'   // "1. Element title"  – blue-tinted
       | 'section'   // "Performance Evidence" etc. – dark
       | 'subgroup'; // "Approaches to service delivery:" – italic, light
};
type DataRow = { kind: 'data'; key: string; label: string };
type Row = SpanRow | DataRow;

/** Items that end with ":" are treated as sub-group labels (no task cells). */
function isSubGroup(text: string) {
  return text.trimEnd().endsWith(':');
}

function buildRows(unit: UnitOfCompetency): Row[] {
  const rows: Row[] = [];

  // ── Elements & Performance Criteria ──────────────────────────────────────────
  for (const el of unit.elements) {
    rows.push({
      kind:  'span',
      key:   `el-${el.number}`,
      label: `${el.number}. ${el.title}`,
      style: 'element',
    });
    for (const pc of el.performanceCriteria) {
      rows.push({
        kind:  'data',
        key:   `pc-${el.number}-${pc.number}`,
        label: `${pc.number}  ${pc.text}`,
      });
    }
  }

  // ── Foundation Skills ─────────────────────────────────────────────────────────
  const fs = unit.foundationSkills ?? [];
  if (fs.length > 0) {
    rows.push({ kind: 'span', key: 'fs-hdr', label: 'Foundation Skills', style: 'section' });
    fs.forEach((s, i) => {
      if (s.skill) {
        // Skill type becomes a sub-group label; description is the data row
        rows.push({ kind: 'span', key: `fs-sg-${i}`, label: `${s.skill}:`, style: 'subgroup' });
        rows.push({ kind: 'data', key: `fs-${i}`, label: s.description });
      } else if (isSubGroup(s.description)) {
        rows.push({ kind: 'span', key: `fs-sg-${i}`, label: s.description, style: 'subgroup' });
      } else {
        rows.push({ kind: 'data', key: `fs-${i}`, label: `FS ${i + 1}: ${s.description}` });
      }
    });
  }

  // ── Performance Evidence ──────────────────────────────────────────────────────
  const pe = unit.performanceEvidence ?? [];
  if (pe.length > 0) {
    rows.push({ kind: 'span', key: 'pe-hdr', label: 'Performance Evidence', style: 'section' });
    let counter = 0;
    pe.forEach((item, i) => {
      if (isSubGroup(item)) {
        rows.push({ kind: 'span', key: `pe-sg-${i}`, label: item, style: 'subgroup' });
      } else {
        counter++;
        rows.push({ kind: 'data', key: `pe-${i}`, label: `PE ${counter}: ${item}` });
      }
    });
  }

  // ── Knowledge Evidence ────────────────────────────────────────────────────────
  const ke = unit.knowledgeEvidence ?? [];
  if (ke.length > 0) {
    rows.push({ kind: 'span', key: 'ke-hdr', label: 'Knowledge Evidence', style: 'section' });
    let counter = 0;
    ke.forEach((item, i) => {
      if (isSubGroup(item)) {
        rows.push({ kind: 'span', key: `ke-sg-${i}`, label: item, style: 'subgroup' });
      } else {
        counter++;
        rows.push({ kind: 'data', key: `ke-${i}`, label: `KE ${counter}: ${item}` });
      }
    });
  }

  // ── Assessment Conditions ─────────────────────────────────────────────────────
  const ac = unit.assessmentConditions ?? [];
  if (ac.length > 0) {
    rows.push({ kind: 'span', key: 'ac-hdr', label: 'Assessment Conditions', style: 'section' });
    let counter = 0;
    ac.forEach((item, i) => {
      if (isSubGroup(item)) {
        rows.push({ kind: 'span', key: `ac-sg-${i}`, label: item, style: 'subgroup' });
      } else {
        counter++;
        rows.push({ kind: 'data', key: `ac-${i}`, label: `AC ${counter}: ${item}` });
      }
    });
  }

  return rows;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function UnitDisplay({ unit }: { unit: UnitOfCompetency }) {
  const [cells,   setCells]   = useState<CellState>  (() => load(cellKey(unit.code),   () => ({})));
  const [headers, setHeaders] = useState<HeaderState>(() => load(headerKey(unit.code), defaultHeaders));

  // Reload when unit changes
  useEffect(() => {
    setCells(load(cellKey(unit.code), () => ({})));
    setHeaders(load(headerKey(unit.code), defaultHeaders));
  }, [unit.code]);

  // Persist cells
  useEffect(() => { persist(cellKey(unit.code), cells); }, [cells, unit.code]);

  // Persist headers
  useEffect(() => { persist(headerKey(unit.code), headers); }, [headers, unit.code]);

  const setCell = useCallback((rowKey: string, idx: number, value: string) => {
    setCells((prev) => {
      const cur = prev[rowKey] ?? Array<string>(NUM_TASKS).fill('');
      const next = [...cur];
      next[idx] = value;
      return { ...prev, [rowKey]: next };
    });
  }, []);

  const setHeader = useCallback((idx: number, value: string) => {
    setHeaders((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const cellValue = (rowKey: string, idx: number) => cells[rowKey]?.[idx] ?? '';

  const hasContent =
    Object.values(cells).some((arr) => arr.some((v) => v.trim())) ||
    headers.some((h, i) => h !== `Assessment ${i + 1}`);

  const clearAll = () => {
    setCells({});
    setHeaders(defaultHeaders());
  };

  const isCurrent = unit.status?.toLowerCase() === 'current';
  const rows = buildRows(unit);

  return (
    <div className="space-y-4" data-testid="unit-display">

      {/* ── Unit header bar ── */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-base font-bold text-primary bg-primary/10 px-3 py-1 rounded border border-primary/20">
              {unit.code}
            </span>
            {unit.status && (
              <Badge className={isCurrent ? 'bg-emerald-600 text-white border-0' : 'bg-gray-100 text-gray-600 border-0'}>
                {unit.status}
              </Badge>
            )}
            {unit.release && (
              <span className="text-xs text-gray-400">Release {unit.release}</span>
            )}
          </div>
          <p className="text-base font-semibold text-gray-900">{unit.title}</p>
        </div>
        {hasContent && (
          <Button variant="ghost" size="sm" onClick={clearAll}
            className="text-gray-400 hover:text-red-500 shrink-0 text-xs">
            <RotateCcw className="w-3 h-3 mr-1" />Clear all
          </Button>
        )}
      </div>

      {/* ── Mapping table ── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 720 }} data-testid="mapping-table">
          <colgroup>
            {/* Descriptor column */}
            <col style={{ width: '34%', minWidth: 240 }} />
            {/* Assessment columns */}
            {Array.from({ length: NUM_TASKS }, (_, i) => (
              <col key={i} style={{ width: `${66 / NUM_TASKS}%`, minWidth: 120 }} />
            ))}
          </colgroup>

          <thead>
            {/* Application banner */}
            {unit.description && (
              <tr>
                <td colSpan={1 + NUM_TASKS}
                  className="border border-gray-400 bg-gray-800 text-white px-4 py-2.5 text-sm leading-relaxed">
                  <span className="font-semibold text-gray-300 text-xs uppercase tracking-wider mr-2">Application</span>
                  {unit.description}
                </td>
              </tr>
            )}

            {/* Column header row — first col fixed, assessment cols editable */}
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide align-top">
                Performance Criteria
              </th>
              {headers.map((h, i) => (
                <th key={i} className="border border-gray-400 p-0 align-top font-normal">
                  <CellInput
                    value={h}
                    onChange={(v) => setHeader(i, v)}
                    placeholder={`Assessment ${i + 1}`}
                    className="text-xs font-semibold text-gray-700 text-center p-2"
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {

              /* ── Spanning rows ── */
              if (row.kind === 'span') {
                if (row.style === 'element') {
                  // Element heading — bold, blue tint, slightly larger
                  return (
                    <tr key={row.key}>
                      <td colSpan={1 + NUM_TASKS}
                        className="border border-gray-400 bg-blue-50 px-3 py-2 font-bold text-blue-900 text-sm">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                if (row.style === 'section') {
                  // Section header — dark, uppercase
                  return (
                    <tr key={row.key}>
                      <td colSpan={1 + NUM_TASKS}
                        className="border border-gray-400 bg-gray-700 text-white px-3 py-2 font-semibold text-xs uppercase tracking-wider">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                // Sub-group label — light, italic
                return (
                  <tr key={row.key}>
                    <td colSpan={1 + NUM_TASKS}
                      className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs italic text-gray-600">
                      {row.label}
                    </td>
                  </tr>
                );
              }

              /* ── Data rows — descriptor + editable assessment cells ── */
              return (
                <tr key={row.key} className="even:bg-gray-50 hover:bg-blue-50/20">
                  <td className="border border-gray-300 px-3 py-2 text-gray-800 leading-snug align-top text-sm">
                    {row.label}
                  </td>
                  {Array.from({ length: NUM_TASKS }, (_, i) => (
                    <td key={i} className="border border-gray-300 p-0 align-top">
                      <CellInput
                        value={cellValue(row.key, i)}
                        onChange={(v) => setCell(row.key, i, v)}
                        placeholder="…"
                        className="text-sm p-2"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={1 + NUM_TASKS}
                  className="border border-gray-300 py-12 text-center text-gray-400 text-sm">
                  No content found for this unit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
