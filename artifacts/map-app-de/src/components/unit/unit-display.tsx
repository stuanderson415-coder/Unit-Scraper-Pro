import { useState, useEffect, useRef, useCallback } from 'react';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw, Minus, Plus } from 'lucide-react';

const MIN_TASKS = 1;
const MAX_TASKS = 12;
const DEFAULT_TASKS = 5;

// ── Persistence ────────────────────────────────────────────────────────────────

type CellState   = Record<string, string[]>;
type HeaderState = string[];

const cellKey   = (code: string) => `map-app-de:cells:${code}`;
const headerKey = (code: string) => `map-app-de:headers:${code}`;
const numKey    = (code: string) => `map-app-de:numtasks:${code}`;

function defaultHeaders(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Assessment ${i + 1}`);
}

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

type SpanRow = {
  kind:  'span';
  key:   string;
  label: string;
  style: 'element' | 'section' | 'subgroup';
};
type DataRow = { kind: 'data'; key: string; label: string };
type Row = SpanRow | DataRow;

function isSubGroup(text: string) {
  return text.trimEnd().endsWith(':');
}

function buildRows(unit: UnitOfCompetency): Row[] {
  const rows: Row[] = [];

  // Elements & Performance Criteria
  for (const el of unit.elements) {
    rows.push({ kind: 'span', key: `el-${el.number}`, label: `${el.number}. ${el.title}`, style: 'element' });
    for (const pc of el.performanceCriteria) {
      rows.push({ kind: 'data', key: `pc-${el.number}-${pc.number}`, label: `${pc.number}  ${pc.text}` });
    }
  }

  // Foundation Skills
  const fs = unit.foundationSkills ?? [];
  if (fs.length > 0) {
    rows.push({ kind: 'span', key: 'fs-hdr', label: 'Foundation Skills', style: 'section' });
    fs.forEach((s, i) => {
      if (s.skill) {
        rows.push({ kind: 'span', key: `fs-sg-${i}`, label: `${s.skill}:`, style: 'subgroup' });
        rows.push({ kind: 'data', key: `fs-${i}`, label: s.description });
      } else if (isSubGroup(s.description)) {
        rows.push({ kind: 'span', key: `fs-sg-${i}`, label: s.description, style: 'subgroup' });
      } else {
        rows.push({ kind: 'data', key: `fs-${i}`, label: `FS ${i + 1}: ${s.description}` });
      }
    });
  }

  // Performance Evidence
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

  // Knowledge Evidence
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

  // Assessment Conditions
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
  const [numTasks, setNumTasksState] = useState<number>(() =>
    load(numKey(unit.code), () => DEFAULT_TASKS)
  );
  const [cells,   setCells]   = useState<CellState>  (() => load(cellKey(unit.code),   () => ({})));
  const [headers, setHeaders] = useState<HeaderState>(() =>
    load(headerKey(unit.code), () => defaultHeaders(load(numKey(unit.code), () => DEFAULT_TASKS)))
  );

  // Reload when unit changes
  useEffect(() => {
    const n = load(numKey(unit.code), () => DEFAULT_TASKS);
    setNumTasksState(n);
    setCells(load(cellKey(unit.code), () => ({})));
    setHeaders(load(headerKey(unit.code), () => defaultHeaders(n)));
  }, [unit.code]);

  // Persist
  useEffect(() => { persist(cellKey(unit.code),   cells);    }, [cells,   unit.code]);
  useEffect(() => { persist(headerKey(unit.code), headers);  }, [headers, unit.code]);
  useEffect(() => { persist(numKey(unit.code),    numTasks); }, [numTasks, unit.code]);

  // Adjust columns — grow: append default headers; shrink: trim (data kept)
  const setNumTasks = useCallback((n: number) => {
    const clamped = Math.min(MAX_TASKS, Math.max(MIN_TASKS, n));
    setNumTasksState(clamped);
    setHeaders((prev) => {
      if (clamped > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: clamped - prev.length }, (_, i) => `Assessment ${prev.length + i + 1}`),
        ];
      }
      return prev.slice(0, clamped);
    });
  }, []);

  const setCell = useCallback((rowKey: string, idx: number, value: string) => {
    setCells((prev) => {
      const cur = prev[rowKey] ?? [];
      const next = Array.from({ length: Math.max(cur.length, idx + 1) }, (_, i) => cur[i] ?? '');
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
    headers.some((h, i) => h !== `Assessment ${i + 1}`) ||
    numTasks !== DEFAULT_TASKS;

  const clearAll = () => {
    setCells({});
    setHeaders(defaultHeaders(numTasks));
  };

  const isCurrent = unit.status?.toLowerCase() === 'current';
  const rows = buildRows(unit);

  return (
    <div className="space-y-4" data-testid="unit-display">

      {/* Unit header bar */}
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

        {/* Controls: column stepper + clear */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Assessment column stepper */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Assessments</span>
            <button
              onClick={() => setNumTasks(numTasks - 1)}
              disabled={numTasks <= MIN_TASKS}
              className="w-6 h-6 flex items-center justify-center rounded text-purple-700 hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Remove a column"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-sm font-bold text-gray-800 w-4 text-center">{numTasks}</span>
            <button
              onClick={() => setNumTasks(numTasks + 1)}
              disabled={numTasks >= MAX_TASKS}
              className="w-6 h-6 flex items-center justify-center rounded text-purple-700 hover:bg-purple-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Add a column"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {hasContent && (
            <Button variant="ghost" size="sm" onClick={clearAll}
              className="text-gray-400 hover:text-red-500 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" />Clear all
            </Button>
          )}
        </div>
      </div>

      {/* Mapping table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: 480 + numTasks * 120 }} data-testid="mapping-table">
          <colgroup>
            <col style={{ width: '34%', minWidth: 240 }} />
            {Array.from({ length: numTasks }, (_, i) => (
              <col key={i} style={{ width: `${66 / numTasks}%`, minWidth: 110 }} />
            ))}
          </colgroup>

          <thead>
            {/* Application banner */}
            {unit.description && (
              <tr>
                <td colSpan={1 + numTasks}
                  className="border border-gray-400 bg-gray-800 text-white px-4 py-2.5 text-sm leading-relaxed">
                  <span className="font-semibold text-gray-300 text-xs uppercase tracking-wider mr-2">Application</span>
                  {unit.description}
                </td>
              </tr>
            )}

            {/* Column header row */}
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide align-top">
                Performance Criteria
              </th>
              {Array.from({ length: numTasks }, (_, i) => (
                <th key={i} className="border border-gray-400 p-0 align-top font-normal">
                  <CellInput
                    value={headers[i] ?? `Assessment ${i + 1}`}
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
              if (row.kind === 'span') {
                if (row.style === 'element') {
                  return (
                    <tr key={row.key}>
                      <td colSpan={1 + numTasks}
                        className="border border-gray-400 bg-blue-50 px-3 py-2 font-bold text-blue-900 text-sm">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                if (row.style === 'section') {
                  return (
                    <tr key={row.key}>
                      <td colSpan={1 + numTasks}
                        className="border border-gray-400 bg-gray-700 text-white px-3 py-2 font-semibold text-xs uppercase tracking-wider">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={row.key}>
                    <td colSpan={1 + numTasks}
                      className="border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs italic text-gray-600">
                      {row.label}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row.key} className="even:bg-gray-50 hover:bg-blue-50/20">
                  <td className="border border-gray-300 px-3 py-2 text-gray-800 leading-snug align-top text-sm">
                    {row.label}
                  </td>
                  {Array.from({ length: numTasks }, (_, i) => (
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
                <td colSpan={1 + numTasks}
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
