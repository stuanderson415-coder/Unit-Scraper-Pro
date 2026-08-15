import { useState, useEffect, useCallback } from 'react';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

const NUM_TASKS = 5;

type TaskRow = { key: string };
type CheckboxState = Record<string, boolean[]>;

function storageKey(unitCode: string) {
  return `map-app-de:mapping:${unitCode}`;
}

function loadMapping(unitCode: string): CheckboxState {
  try {
    const raw = localStorage.getItem(storageKey(unitCode));
    return raw ? (JSON.parse(raw) as CheckboxState) : {};
  } catch {
    return {};
  }
}

function saveMapping(unitCode: string, state: CheckboxState) {
  try {
    localStorage.setItem(storageKey(unitCode), JSON.stringify(state));
  } catch {
    // storage quota exceeded — ignore
  }
}

// ── Row model ──────────────────────────────────────────────────────────────────

type SectionHeaderRow = { type: 'section'; key: string; label: string };
type DataRow = { type: 'data'; key: string; label: string; checkable: boolean };
type MatrixRow = SectionHeaderRow | DataRow;

function buildRows(unit: UnitOfCompetency): MatrixRow[] {
  const rows: MatrixRow[] = [];

  // Elements & PCs
  for (const el of unit.elements) {
    rows.push({
      type: 'section',
      key: `el-${el.number}`,
      label: `Element ${el.number}: ${el.title}`,
    });
    for (const pc of el.performanceCriteria) {
      rows.push({
        type: 'data',
        key: `pc-${el.number}-${pc.number}`,
        label: `${pc.number}\u2003${pc.text}`,
        checkable: true,
      });
    }
  }

  // Foundation Skills
  const fs = unit.foundationSkills ?? [];
  if (fs.length > 0) {
    rows.push({ type: 'section', key: 'fs-header', label: 'Foundation Skills' });
    fs.forEach((s, i) => {
      const label = s.skill ? `${s.skill}: ${s.description}` : s.description;
      rows.push({ type: 'data', key: `fs-${i}`, label, checkable: true });
    });
  }

  // Performance Evidence
  const pe = unit.performanceEvidence ?? [];
  if (pe.length > 0) {
    rows.push({ type: 'section', key: 'pe-header', label: 'Performance Evidence' });
    pe.forEach((item, i) =>
      rows.push({ type: 'data', key: `pe-${i}`, label: item, checkable: true }),
    );
  }

  // Knowledge Evidence
  const ke = unit.knowledgeEvidence ?? [];
  if (ke.length > 0) {
    rows.push({ type: 'section', key: 'ke-header', label: 'Knowledge Evidence' });
    ke.forEach((item, i) =>
      rows.push({ type: 'data', key: `ke-${i}`, label: item, checkable: true }),
    );
  }

  // Assessment Conditions
  const ac = unit.assessmentConditions ?? [];
  if (ac.length > 0) {
    rows.push({ type: 'section', key: 'ac-header', label: 'Assessment Conditions' });
    ac.forEach((item, i) =>
      rows.push({ type: 'data', key: `ac-${i}`, label: item, checkable: true }),
    );
  }

  return rows;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function UnitDisplay({ unit }: { unit: UnitOfCompetency }) {
  const [mapping, setMapping] = useState<CheckboxState>(() =>
    loadMapping(unit.code),
  );

  // Reload mapping when unit changes
  useEffect(() => {
    setMapping(loadMapping(unit.code));
  }, [unit.code]);

  // Persist mapping whenever it changes
  useEffect(() => {
    saveMapping(unit.code, mapping);
  }, [mapping, unit.code]);

  const toggle = useCallback((row: TaskRow, taskIdx: number) => {
    setMapping((prev) => {
      const current = prev[row.key] ?? Array<boolean>(NUM_TASKS).fill(false);
      const updated = [...current] as boolean[];
      updated[taskIdx] = !updated[taskIdx];
      return { ...prev, [row.key]: updated };
    });
  }, []);

  const isChecked = (rowKey: string, taskIdx: number) =>
    mapping[rowKey]?.[taskIdx] ?? false;

  const clearMapping = () => {
    setMapping({});
  };

  const isCurrent = unit.status?.toLowerCase() === 'current';
  const rows = buildRows(unit);
  const hasAnyCheck = Object.values(mapping).some((arr) => arr.some(Boolean));

  return (
    <div
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out"
      data-testid="unit-display"
    >
      {/* Unit header */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="font-mono text-lg font-bold text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20"
              data-testid="unit-code"
            >
              {unit.code}
            </span>
            {unit.status && (
              <Badge
                variant={isCurrent ? 'default' : 'secondary'}
                className={
                  isCurrent
                    ? 'bg-emerald-600 text-white border-0'
                    : 'bg-slate-100 text-slate-600 border-0'
                }
              >
                {unit.status}
              </Badge>
            )}
            {unit.release && (
              <span className="text-xs text-slate-400 font-medium">
                Release {unit.release}
              </span>
            )}
          </div>
          <h2 className="text-lg font-semibold text-slate-900 leading-snug">
            {unit.title}
          </h2>
        </div>
        {hasAnyCheck && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMapping}
            className="text-slate-500 hover:text-red-600 shrink-0"
            data-testid="button-clear-mapping"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Clear mapping
          </Button>
        )}
      </div>

      {/* Mapping matrix */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full border-collapse text-sm min-w-[640px]">
          <colgroup>
            <col style={{ minWidth: '320px' }} />
            {Array.from({ length: NUM_TASKS }, (_, i) => (
              <col key={i} style={{ width: '80px', minWidth: '72px' }} />
            ))}
          </colgroup>

          <thead>
            {/* Application row — full width */}
            {unit.description && (
              <tr>
                <td
                  colSpan={1 + NUM_TASKS}
                  className="px-5 py-3 bg-slate-800 text-white text-sm leading-relaxed"
                  data-testid="application-row"
                >
                  <span className="font-semibold uppercase tracking-wider text-xs text-slate-300 mr-2">
                    Application
                  </span>
                  {unit.description}
                </td>
              </tr>
            )}

            {/* Column headers */}
            <tr className="bg-slate-100 border-b-2 border-slate-300">
              <th className="text-left px-5 py-2.5 font-semibold text-slate-600 uppercase text-xs tracking-wider">
                Element / PC
              </th>
              {Array.from({ length: NUM_TASKS }, (_, i) => (
                <th
                  key={i}
                  className="text-center px-2 py-2.5 font-semibold text-slate-600 uppercase text-xs tracking-wider"
                  data-testid={`header-task-${i + 1}`}
                >
                  Task {i + 1}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              if (row.type === 'section') {
                return (
                  <tr
                    key={row.key}
                    className="bg-slate-50 border-y border-slate-200"
                    data-testid={`section-${row.key}`}
                  >
                    <td
                      colSpan={1 + NUM_TASKS}
                      className="px-5 py-2 font-semibold text-slate-800 text-xs uppercase tracking-wider"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={row.key}
                  className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors group"
                  data-testid={`row-${row.key}`}
                >
                  <td className="px-5 py-3 text-slate-700 leading-snug text-sm">
                    {row.label}
                  </td>
                  {Array.from({ length: NUM_TASKS }, (_, i) => (
                    <td
                      key={i}
                      className="text-center px-2 py-3 border-l border-slate-100"
                    >
                      <Checkbox
                        checked={isChecked(row.key, i)}
                        onCheckedChange={() => toggle(row, i)}
                        className="mx-auto data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        data-testid={`checkbox-${row.key}-task-${i + 1}`}
                        aria-label={`Task ${i + 1} for ${row.key}`}
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
                  className="h-24 text-center text-slate-500 text-sm"
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
