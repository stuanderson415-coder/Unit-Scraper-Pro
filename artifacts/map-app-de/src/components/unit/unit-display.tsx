import { useState, useEffect, useRef, useCallback } from 'react';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

const NUM_TASKS = 5;

// ── Persistence ───────────────────────────────────────────────────────────────

type CellState = Record<string, string[]>; // rowKey → [task1, task2, task3, task4, task5]

function storageKey(code: string) {
  return `map-app-de:mapping:${code}`;
}
function loadState(code: string): CellState {
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as CellState) : {};
  } catch {
    return {};
  }
}
function saveState(code: string, state: CellState) {
  try {
    localStorage.setItem(storageKey(code), JSON.stringify(state));
  } catch { /* quota */ }
}

// ── Auto-resizing textarea cell ────────────────────────────────────────────────

function CellInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 32) + 'px';
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      onInput={resize}
      className="w-full resize-none overflow-hidden bg-transparent border-0 focus:outline-none focus:ring-0 text-sm p-1.5 leading-snug placeholder:text-gray-300"
      placeholder="…"
    />
  );
}

// ── Row model ──────────────────────────────────────────────────────────────────

type SpanRow   = { kind: 'span';   key: string; label: string; style: 'element' | 'section' };
type DataRow   = { kind: 'data';   key: string; label: string };

type Row = SpanRow | DataRow;

function buildRows(unit: UnitOfCompetency): Row[] {
  const rows: Row[] = [];

  // ── Elements & PCs ──
  for (const el of unit.elements) {
    rows.push({
      kind: 'span',
      key: `el-${el.number}`,
      label: `Element ${el.number}: ${el.title}`,
      style: 'element',
    });
    for (const pc of el.performanceCriteria) {
      rows.push({
        kind: 'data',
        key: `pc-${el.number}-${pc.number}`,
        label: `${pc.number}\u2003${pc.text}`,
      });
    }
  }

  // ── Foundation Skills ──
  const fs = unit.foundationSkills ?? [];
  if (fs.length > 0) {
    rows.push({ kind: 'span', key: 'fs-header', label: 'Foundation Skills', style: 'section' });
    fs.forEach((s, i) => {
      const label = s.skill ? `${s.skill}: ${s.description}` : s.description;
      rows.push({ kind: 'data', key: `fs-${i}`, label });
    });
  }

  // ── Performance Evidence ──
  const pe = unit.performanceEvidence ?? [];
  if (pe.length > 0) {
    rows.push({ kind: 'span', key: 'pe-header', label: 'Performance Evidence', style: 'section' });
    pe.forEach((item, i) =>
      rows.push({ kind: 'data', key: `pe-${i}`, label: item }),
    );
  }

  // ── Knowledge Evidence ──
  const ke = unit.knowledgeEvidence ?? [];
  if (ke.length > 0) {
    rows.push({ kind: 'span', key: 'ke-header', label: 'Knowledge Evidence', style: 'section' });
    ke.forEach((item, i) =>
      rows.push({ kind: 'data', key: `ke-${i}`, label: item }),
    );
  }

  // ── Assessment Conditions ──
  const ac = unit.assessmentConditions ?? [];
  if (ac.length > 0) {
    rows.push({ kind: 'span', key: 'ac-header', label: 'Assessment Conditions', style: 'section' });
    ac.forEach((item, i) =>
      rows.push({ kind: 'data', key: `ac-${i}`, label: item }),
    );
  }

  return rows;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function UnitDisplay({ unit }: { unit: UnitOfCompetency }) {
  const [cells, setCells] = useState<CellState>(() => loadState(unit.code));

  useEffect(() => {
    setCells(loadState(unit.code));
  }, [unit.code]);

  useEffect(() => {
    saveState(unit.code, cells);
  }, [cells, unit.code]);

  const setCell = useCallback((rowKey: string, taskIdx: number, value: string) => {
    setCells((prev) => {
      const current = prev[rowKey] ?? Array<string>(NUM_TASKS).fill('');
      const updated = [...current];
      updated[taskIdx] = value;
      return { ...prev, [rowKey]: updated };
    });
  }, []);

  const cellValue = (rowKey: string, taskIdx: number) =>
    cells[rowKey]?.[taskIdx] ?? '';

  const hasContent = Object.values(cells).some((arr) =>
    arr.some((v) => v.trim().length > 0),
  );

  const clearAll = () => setCells({});

  const isCurrent = unit.status?.toLowerCase() === 'current';
  const rows = buildRows(unit);

  return (
    <div className="space-y-5" data-testid="unit-display">

      {/* ── Unit header ── */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="font-mono text-base font-bold text-primary bg-primary/10 px-3 py-1 rounded border border-primary/20"
              data-testid="unit-code"
            >
              {unit.code}
            </span>
            {unit.status && (
              <Badge
                variant={isCurrent ? 'default' : 'secondary'}
                className={isCurrent
                  ? 'bg-emerald-600 text-white border-0'
                  : 'bg-gray-100 text-gray-600 border-0'}
              >
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
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-gray-400 hover:text-red-500 shrink-0 text-xs"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {/* ── Mapping table ── */}
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-sm"
          style={{ minWidth: '700px' }}
          data-testid="mapping-table"
        >
          <colgroup>
            <col style={{ width: '35%', minWidth: '260px' }} />
            {Array.from({ length: NUM_TASKS }, (_, i) => (
              <col key={i} style={{ width: `${65 / NUM_TASKS}%`, minWidth: '110px' }} />
            ))}
          </colgroup>

          {/* ── Application row ── */}
          {unit.description && (
            <thead>
              <tr>
                <td
                  colSpan={1 + NUM_TASKS}
                  className="border border-gray-400 bg-gray-800 text-white px-4 py-2.5 text-sm leading-relaxed"
                  data-testid="application-row"
                >
                  <span className="font-semibold text-gray-300 text-xs uppercase tracking-wider mr-2">
                    Application
                  </span>
                  {unit.description}
                </td>
              </tr>
              {/* ── Column headers ── */}
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Element / Performance Criteria
                </th>
                {Array.from({ length: NUM_TASKS }, (_, i) => (
                  <th
                    key={i}
                    className="border border-gray-300 px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide"
                    data-testid={`header-task-${i + 1}`}
                  >
                    Task {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
          )}

          <tbody>
            {rows.map((row) => {
              /* ── Spanning header row (element or section) ── */
              if (row.kind === 'span') {
                const isElement = row.style === 'element';
                return (
                  <tr key={row.key} data-testid={`span-${row.key}`}>
                    <td
                      colSpan={1 + NUM_TASKS}
                      className={[
                        'border border-gray-300 px-3 py-2 font-semibold',
                        isElement
                          ? 'bg-blue-50 text-blue-900 text-sm'
                          : 'bg-gray-200 text-gray-700 text-xs uppercase tracking-wider',
                      ].join(' ')}
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              /* ── Data row with editable task cells ── */
              return (
                <tr
                  key={row.key}
                  className="even:bg-gray-50 hover:bg-blue-50/30 transition-colors"
                  data-testid={`row-${row.key}`}
                >
                  <td
                    className="border border-gray-300 px-3 py-2 text-gray-700 leading-snug align-top"
                  >
                    {row.label}
                  </td>
                  {Array.from({ length: NUM_TASKS }, (_, i) => (
                    <td
                      key={i}
                      className="border border-gray-300 p-0 align-top"
                    >
                      <CellInput
                        value={cellValue(row.key, i)}
                        onChange={(v) => setCell(row.key, i, v)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={1 + NUM_TASKS}
                  className="border border-gray-300 py-10 text-center text-gray-400"
                >
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
