import { useState, useEffect, useRef, useCallback } from 'react';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw, FileDown, FileText, RefreshCw, ClipboardCopy, Check } from 'lucide-react';
import { buildRows } from '@/lib/unit-rows';
import { exportToWord }    from '@/lib/export-doc';
import { exportToMarkdown } from '@/lib/export-md';
import { copyTableToClipboard } from '@/lib/copy-table';

// ── Persistence ────────────────────────────────────────────────────────────────

type CellState   = Record<string, string[]>;
type HeaderState = string[];

const cellKey   = (code: string) => `map-app-de:cells:${code}`;
const headerKey = (code: string) => `map-app-de:headers:${code}`;

function defaultHeaders(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `Task ${i + 1}`);
}
function load<T>(key: string, fallback: () => T): T {
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback(); }
  catch { return fallback(); }
}
function persist(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

// ── Auto-resize textarea ───────────────────────────────────────────────────────

function CellInput({
  value, onChange, placeholder, className = '',
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
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
      onChange={e => onChange(e.target.value)}
      onInput={resize}
      className={`w-full resize-none overflow-hidden bg-transparent border-0 focus:outline-none focus:ring-0 leading-snug placeholder:text-gray-300 ${className}`}
    />
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  unit: UnitOfCompetency;
  numTasks: number;   // owned by home.tsx
  docTitle: string;
}

export function UnitDisplay({ unit, numTasks, docTitle }: Props) {
  const [cells,   setCells]   = useState<CellState>  (() => load(cellKey(unit.code),   () => ({})));
  const [headers, setHeaders] = useState<HeaderState>(() =>
    load(headerKey(unit.code), () => defaultHeaders(numTasks)),
  );
  const [exportingDoc,  setExportingDoc]  = useState(false);
  const [exportingMd,   setExportingMd]   = useState(false);
  const [copied,        setCopied]         = useState(false);

  // Reload when unit changes
  useEffect(() => {
    setCells(load(cellKey(unit.code), () => ({})));
    setHeaders(load(headerKey(unit.code), () => defaultHeaders(numTasks)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit.code]);

  // Sync header array length when numTasks changes from parent
  useEffect(() => {
    setHeaders(prev => {
      if (numTasks > prev.length) {
        return [...prev, ...Array.from({ length: numTasks - prev.length }, (_, i) => `Task ${prev.length + i + 1}`)];
      }
      return prev.slice(0, numTasks);
    });
  }, [numTasks]);

  // Persist
  useEffect(() => { persist(cellKey(unit.code),   cells);   }, [cells,   unit.code]);
  useEffect(() => { persist(headerKey(unit.code), headers); }, [headers, unit.code]);

  const setCell = useCallback((rowKey: string, idx: number, value: string) => {
    setCells(prev => {
      const cur  = prev[rowKey] ?? [];
      const next = Array.from({ length: Math.max(cur.length, idx + 1) }, (_, i) => cur[i] ?? '');
      next[idx]  = value;
      return { ...prev, [rowKey]: next };
    });
  }, []);

  const setHeader = useCallback((idx: number, value: string) => {
    setHeaders(prev => { const n = [...prev]; n[idx] = value; return n; });
  }, []);

  const cellValue = (rowKey: string, idx: number) => cells[rowKey]?.[idx] ?? '';

  // Regenerate: wipe mapping data, reset headers to defaults for current numTasks
  const regenerate = () => {
    setCells({});
    setHeaders(defaultHeaders(numTasks));
  };

  const handleExportDoc = () => {
    setExportingDoc(true);
    try { exportToWord(unit, numTasks, headers, cells, docTitle); }
    finally { setExportingDoc(false); }
  };

  const handleExportMd = () => {
    setExportingMd(true);
    try { exportToMarkdown(unit, numTasks, headers, cells, docTitle); }
    finally { setExportingMd(false); }
  };

  const handleCopy = async () => {
    await copyTableToClipboard(unit, numTasks, headers, cells);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasContent = Object.values(cells).some(a => a.some(v => v.trim()));

  const isCurrent = unit.status?.toLowerCase() === 'current';
  const rows = buildRows(unit);

  return (
    <div className="space-y-4" data-testid="unit-display">

      {/* ── Header bar ── */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-base font-bold px-3 py-1 rounded border bg-zinc-100 border-zinc-300 text-zinc-800">
              {unit.code}
            </span>
            {unit.status && (
              <Badge className={isCurrent ? 'bg-emerald-600 text-white border-0' : 'bg-gray-100 text-gray-600 border-0'}>
                {unit.status}
              </Badge>
            )}
            {unit.release && <span className="text-xs text-gray-400">Release {unit.release}</span>}
          </div>
          <p className="text-base font-semibold text-gray-900">{unit.title}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Copy table to clipboard */}
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className={`text-xs border-zinc-400 hover:bg-zinc-100 transition-colors ${copied ? 'text-emerald-600 border-emerald-400' : 'text-zinc-700'}`}
            title="Copy table — paste into Word, Google Docs, or Excel"
          >
            {copied
              ? <><Check className="w-3.5 h-3.5 mr-1.5" />Copied!</>
              : <><ClipboardCopy className="w-3.5 h-3.5 mr-1.5" />Copy Table</>}
          </Button>

          {/* Export to Word */}
          <Button
            onClick={handleExportDoc}
            disabled={exportingDoc}
            className="bg-zinc-900 hover:bg-zinc-700 text-white text-xs shadow-sm"
            size="sm"
          >
            <FileDown className="w-3.5 h-3.5 mr-1.5" />
            {exportingDoc ? 'Exporting…' : 'Export Word'}
          </Button>

          {/* Export to Markdown */}
          <Button
            onClick={handleExportMd}
            disabled={exportingMd}
            variant="outline"
            size="sm"
            className="text-xs border-zinc-400 text-zinc-700 hover:bg-zinc-100"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            {exportingMd ? 'Exporting…' : 'Export MD'}
          </Button>

          {/* Regenerate: clear & rebuild with current numTasks */}
          <Button
            variant="outline"
            size="sm"
            onClick={regenerate}
            className="text-xs border-zinc-300 text-zinc-600 hover:bg-zinc-100"
            title="Clear all mapping data and reset column headers to defaults"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Regenerate
          </Button>

          {/* Clear all (only when content exists) */}
          {hasContent && (
            <Button variant="ghost" size="sm" onClick={() => setCells({})}
              className="text-gray-400 hover:text-red-500 text-xs">
              <RotateCcw className="w-3 h-3 mr-1" />Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── Mapping table — plain white ── */}
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-sm bg-white"
          style={{ minWidth: 480 + numTasks * 120 }}
          data-testid="mapping-table"
        >
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
                  className="border border-gray-500 bg-gray-800 text-white px-4 py-2.5 text-sm leading-relaxed">
                  <span className="font-semibold text-gray-300 text-xs uppercase tracking-wider mr-2">Application</span>
                  {unit.description}
                </td>
              </tr>
            )}

            {/* Column headers — editable */}
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wide align-top">
                Performance Criteria / Requirement
              </th>
              {Array.from({ length: numTasks }, (_, i) => (
                <th key={i} className="border border-gray-400 p-0 align-top font-normal">
                  <CellInput
                    value={headers[i] ?? `Assessment ${i + 1}`}
                    onChange={v => setHeader(i, v)}
                    placeholder={`Assessment ${i + 1}`}
                    className="text-xs font-semibold text-gray-700 text-center p-2"
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map(row => {
              if (row.kind === 'span') {
                if (row.style === 'element') {
                  return (
                    <tr key={row.key}>
                      <td colSpan={1 + numTasks}
                        className="border border-gray-400 bg-white px-3 py-2 font-bold text-gray-900 text-sm">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                if (row.style === 'section') {
                  return (
                    <tr key={row.key}>
                      <td colSpan={1 + numTasks}
                        className="border border-gray-400 bg-gray-200 text-gray-800 px-3 py-2 font-bold text-xs uppercase tracking-wider">
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                // subgroup
                return (
                  <tr key={row.key}>
                    <td colSpan={1 + numTasks}
                      className="border border-gray-300 bg-white px-4 py-1.5 text-xs italic text-gray-500">
                      {row.label}
                    </td>
                  </tr>
                );
              }

              // Data row
              return (
                <tr key={row.key} className="hover:bg-gray-50/60">
                  <td className="border border-gray-300 px-3 py-2 text-gray-800 leading-snug align-top text-sm bg-white">
                    {row.label}
                  </td>
                  {Array.from({ length: numTasks }, (_, i) => (
                    <td key={i} className="border border-gray-300 p-0 align-top bg-white">
                      <CellInput
                        value={cellValue(row.key, i)}
                        onChange={v => setCell(row.key, i, v)}
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
                  className="border border-gray-300 py-12 text-center text-gray-400 text-sm bg-white">
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
