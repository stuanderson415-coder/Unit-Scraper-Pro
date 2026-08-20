import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { UnitOfCompetency } from '@workspace/api-client-react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardCheck,
  Download,
  FileCheck2,
  GripVertical,
  ListPlus,
  MessageSquareText,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buildRows } from '@/lib/unit-rows';
import { exportRplToWord } from '@/lib/export-rpl-doc';
import {
  EVIDENCE_COLOURS,
  createEmptyRplRecord,
  evidenceCode,
  hasRplRecord,
  listRplStudents,
  loadRplRecordForStudent,
  loadRplRecord,
  newEvidenceId,
  persistRplRecord,
  type EvidenceItem,
  type InterviewOutcome,
  type InterviewRecord,
  type RplRecord,
  type StudentRecordSummary,
  type StudentDetails,
} from '@/lib/rpl-state';

type Stage = 'student' | 'evidence' | 'mapping' | 'gaps' | 'review' | 'final';

const STAGES: Array<{ id: Stage; label: string; short: string; icon: typeof UserRound }> = [
  { id: 'student', label: 'Student details', short: 'Student', icon: UserRound },
  { id: 'evidence', label: 'Evidence log', short: 'Evidence', icon: ListPlus },
  { id: 'mapping', label: 'RPL mapping', short: 'Mapping', icon: GripVertical },
  { id: 'gaps', label: 'Gaps interview', short: 'Gaps', icon: MessageSquareText },
  { id: 'review', label: 'Review', short: 'Review', icon: ClipboardCheck },
  { id: 'final', label: 'Final RPL mapping', short: 'Final', icon: FileCheck2 },
];

type NewEvidenceDraft = Omit<EvidenceItem, 'id'>;

const DEFAULT_NEW_EVIDENCE: NewEvidenceDraft = {
  title: '',
  reference: '',
  notes: '',
  color: EVIDENCE_COLOURS[0].value,
};

function statusForOutcome(outcome: InterviewOutcome) {
  if (outcome === 'resolved') return 'Resolved';
  if (outcome === 'not-resolved') return 'Not resolved';
  return 'Pending';
}

function tileStyle(color: string) {
  const palette = EVIDENCE_COLOURS.find(item => item.value === color);
  return { backgroundColor: palette?.soft ?? '#e2e8f0', borderColor: color, color };
}

function EvidenceTile({
  evidence,
  index,
  compact = false,
  selected = false,
  onSelect,
  onDragStart,
  onRemove,
}: {
  evidence: EvidenceItem;
  index: number;
  compact?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onDragStart?: () => void;
  onRemove?: () => void;
}) {
  const tile = (
    <>
      <span className="mr-1 font-mono font-bold">{evidenceCode(index)}</span>
      <span className="font-semibold">{evidence.title}</span>
      {!compact && evidence.reference && <span className="mt-0.5 block opacity-75">{evidence.reference}</span>}
    </>
  );
  return (
    <div
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      className={`group relative block w-full rounded-md border-l-4 px-2.5 py-2 text-left shadow-[2px_2px_0_rgba(24,24,27,0.16)] transition hover:-translate-y-0.5 hover:shadow-[3px_3px_0_rgba(24,24,27,0.2)] ${selected ? 'ring-2 ring-zinc-900 ring-offset-2' : ''} ${compact ? 'text-[11px]' : 'text-xs'}`}
      style={tileStyle(evidence.color)}
    >
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          className="block w-full text-left outline-none"
          title={onDragStart ? 'Drag to a requirement, or select then use the Map button in a requirement' : evidence.title}
        >
          {tile}
        </button>
      ) : tile}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${evidence.title} from this requirement`}
          className="absolute right-1.5 top-1 rounded p-0.5 text-zinc-700 opacity-0 hover:bg-white/70 group-hover:opacity-100"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.11em] text-zinc-600">{children}</label>;
}

export function RplWorkflow({ unit, studentNumber, prefill, onOpenAssessmentMapping }: { unit: UnitOfCompetency; studentNumber?: string; prefill?: StudentDetails; onOpenAssessmentMapping?: () => void }) {
  const hasPrefill = Boolean(prefill?.name || prefill?.studentNumber);
  const [record, setRecord] = useState<RplRecord>(() => {
    const loaded = studentNumber
      ? loadRplRecordForStudent(unit.code, studentNumber)
      : hasPrefill
        ? createEmptyRplRecord()
        : loadRplRecord(unit.code);
    return prefill ? { ...loaded, student: { ...loaded.student, ...prefill } } : loaded;
  });
  const [activeRecordStudentNumber, setActiveRecordStudentNumber] = useState(
    () => studentNumber ?? (hasPrefill ? 'draft' : (loadRplRecord(unit.code).student.studentNumber.trim() || 'draft')),
  );
  const [savedStudents, setSavedStudents] = useState<StudentRecordSummary[]>(() => listRplStudents(unit.code));
  const [recordConflict, setRecordConflict] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('student');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [dragEvidenceId, setDragEvidenceId] = useState<string | null>(null);
  const [newEvidence, setNewEvidence] = useState(DEFAULT_NEW_EVIDENCE);
  const [exported, setExported] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentStudentNumber = record.student.studentNumber.trim() || 'draft';
    if (currentStudentNumber === activeRecordStudentNumber) {
      persistRplRecord(unit.code, record, activeRecordStudentNumber === 'draft' ? '' : activeRecordStudentNumber);
      setSavedStudents(listRplStudents(unit.code));
    }
  }, [activeRecordStudentNumber, record, unit.code]);

  const rows = useMemo(() => buildRows(unit), [unit]);
  const requirementRows = useMemo(
    () => rows.filter((row): row is Extract<typeof row, { kind: 'data' }> => row.kind === 'data'),
    [rows],
  );
  const evidenceById = useMemo(() => new Map(record.evidence.map(item => [item.id, item])), [record.evidence]);
  const uncoveredRows = requirementRows.filter(row => !(record.mappings[row.key]?.length));
  const resolvedGaps = uncoveredRows.filter(row => record.interviews[row.key]?.outcome === 'resolved').length;
  const coveredRows = requirementRows.length - uncoveredRows.length;
  const selectedEvidence = record.evidence.find(item => item.id === selectedEvidenceId) ?? null;
  const stageIndex = STAGES.findIndex(item => item.id === stage);
  const hasStudent = Boolean(record.student.name.trim() && record.student.studentNumber.trim());

  const updateRecord = (fn: (current: RplRecord) => RplRecord) => {
    setRecord(current => fn(current));
  };

  const addEvidence = () => {
    if (!newEvidence.title.trim()) return;
    updateRecord(current => ({
      ...current,
      evidence: [...current.evidence, { ...newEvidence, id: newEvidenceId(), title: newEvidence.title.trim() }],
    }));
    setNewEvidence(DEFAULT_NEW_EVIDENCE);
  };

  const updateEvidence = (id: string, patch: Partial<EvidenceItem>) => {
    updateRecord(current => ({
      ...current,
      evidence: current.evidence.map(item => item.id === id ? { ...item, ...patch } : item),
    }));
  };

  const deleteEvidence = (id: string) => {
    updateRecord(current => {
      const mappings = Object.fromEntries(
        Object.entries(current.mappings).map(([rowKey, ids]) => [rowKey, ids.filter(itemId => itemId !== id)]),
      );
      return { ...current, evidence: current.evidence.filter(item => item.id !== id), mappings };
    });
    if (selectedEvidenceId === id) setSelectedEvidenceId(null);
  };

  const mapEvidence = (rowKey: string, evidenceId: string) => {
    updateRecord(current => {
      const existing = current.mappings[rowKey] ?? [];
      if (existing.includes(evidenceId)) return current;
      return { ...current, mappings: { ...current.mappings, [rowKey]: [...existing, evidenceId] } };
    });
  };

  const unmapEvidence = (rowKey: string, evidenceId: string) => {
    updateRecord(current => ({
      ...current,
      mappings: { ...current.mappings, [rowKey]: (current.mappings[rowKey] ?? []).filter(id => id !== evidenceId) },
    }));
  };

  const updateInterview = (rowKey: string, patch: Partial<InterviewRecord>) => {
    updateRecord(current => ({
      ...current,
      interviews: {
        ...current.interviews,
        [rowKey]: {
          ...(current.interviews[rowKey] ?? {
            question: '',
            studentResponse: '',
            assessorNotes: '',
            outcome: 'pending' as InterviewOutcome,
          }),
          ...patch,
        },
      },
    }));
  };

  const goNext = () => setStage(STAGES[Math.min(stageIndex + 1, STAGES.length - 1)].id);
  const goPrevious = () => setStage(STAGES[Math.max(stageIndex - 1, 0)].id);

  const onDrop = (rowKey: string) => {
    const evidenceId = dragEvidenceId ?? selectedEvidenceId;
    if (!evidenceId) return;
    mapEvidence(rowKey, evidenceId);
    setDragEvidenceId(null);
  };

  const saveStudentAndContinue = () => {
    const nextStudentNumber = record.student.studentNumber.trim();
    if (!hasStudent) return;
    if (nextStudentNumber !== activeRecordStudentNumber && hasRplRecord(unit.code, nextStudentNumber)) {
      setRecordConflict(nextStudentNumber);
      return;
    }
    setActiveRecordStudentNumber(nextStudentNumber);
    persistRplRecord(unit.code, record, nextStudentNumber);
    setSavedStudents(listRplStudents(unit.code));
    setRecordConflict(null);
    setStage('evidence');
  };

  const openSavedStudent = (studentNumber: string) => {
    setRecord(loadRplRecordForStudent(unit.code, studentNumber));
    setActiveRecordStudentNumber(studentNumber);
    setRecordConflict(null);
    setStage('student');
  };

  const replaceSavedStudent = () => {
    if (!recordConflict) return;
    setActiveRecordStudentNumber(recordConflict);
    persistRplRecord(unit.code, record, recordConflict);
    setSavedStudents(listRplStudents(unit.code));
    setRecordConflict(null);
    setStage('evidence');
  };

  const startNewStudent = () => {
    setRecord(createEmptyRplRecord());
    setActiveRecordStudentNumber('draft');
    setSelectedEvidenceId(null);
    setRecordConflict(null);
    setStage('student');
  };

  const renderStudent = () => (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-800">Start an RPL record</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Student details</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
          This record is saved in this browser against the unit and student number, so you can return to the RPL assessment later.
        </p>
        {savedStudents.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <span className="mr-1 text-xs font-semibold text-zinc-600">Open a saved student:</span>
            {savedStudents.map(student => (
              <button key={student.studentNumber} type="button" onClick={() => openSavedStudent(student.studentNumber)} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${student.studentNumber === activeRecordStudentNumber ? 'border-teal-700 bg-teal-100 text-teal-900' : 'border-zinc-300 bg-white text-zinc-700 hover:border-teal-400'}`}>
                {student.name || 'Unnamed'} · {student.studentNumber}
              </button>
            ))}
            <button type="button" onClick={startNewStudent} className="rounded-full border border-dashed border-zinc-400 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-teal-500 hover:text-teal-800">New record</button>
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <FieldLabel>Student name</FieldLabel>
            <input
              value={record.student.name}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, name: event.target.value } }))}
              placeholder="e.g. Alex Morgan"
              className="h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <FieldLabel>Student number</FieldLabel>
            <input
              value={record.student.studentNumber}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, studentNumber: event.target.value } }))}
              placeholder="e.g. 12345678"
              className="h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <FieldLabel>Trainer / assessor</FieldLabel>
            <input
              value={record.student.trainerName}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, trainerName: event.target.value } }))}
              placeholder="e.g. Jordan Lee"
              className="h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <FieldLabel>Organisation / RTO</FieldLabel>
            <input
              value={record.student.organisation}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, organisation: event.target.value } }))}
              placeholder="e.g. Your RTO"
              className="h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <FieldLabel>Assessment date</FieldLabel>
            <input
              type="date"
              value={record.student.assessmentDate}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, assessmentDate: event.target.value } }))}
              className="h-11 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
        </div>
        {recordConflict && (
          <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p>A saved record already exists for student number <strong>{recordConflict}</strong>. Open the saved record to avoid overwriting it, or intentionally replace it with the details above.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openSavedStudent(recordConflict)}>Open saved record</Button>
              <Button size="sm" className="bg-amber-700 hover:bg-amber-600" onClick={replaceSavedStudent}>Replace saved record</Button>
            </div>
          </div>
        )}
        <div className="mt-8 flex justify-end">
          <Button onClick={saveStudentAndContinue} disabled={!hasStudent} className="bg-teal-800 hover:bg-teal-700">
            Save and continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
      <aside className="rounded-2xl border border-teal-950 bg-teal-900 p-6 text-teal-50 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">RPL record</span>
        <p className="mt-4 text-lg font-semibold leading-7">Evidence is recorded once, then mapped to every requirement it supports.</p>
        <ol className="mt-7 space-y-4 text-sm leading-5 text-teal-100">
          <li><span className="mr-2 font-mono text-teal-300">01</span>Add the student's details.</li>
          <li><span className="mr-2 font-mono text-teal-300">02</span>Log each piece of evidence and its reference.</li>
          <li><span className="mr-2 font-mono text-teal-300">03</span>Map evidence, resolve gaps, then export the final record.</li>
        </ol>
      </aside>
    </div>
  );

  const renderEvidence = () => (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-800">Evidence register</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Log a piece of evidence</h2>
          </div>
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">{record.evidence.length} logged</Badge>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_1fr_1.3fr_auto]">
          <input
            value={newEvidence.title}
            onChange={event => setNewEvidence(current => ({ ...current, title: event.target.value }))}
            onKeyDown={event => { if (event.key === 'Enter') addEvidence(); }}
            placeholder="Evidence title"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          />
          <input
            value={newEvidence.reference}
            onChange={event => setNewEvidence(current => ({ ...current, reference: event.target.value }))}
            placeholder="Reference / date"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          />
          <input
            value={newEvidence.notes}
            onChange={event => setNewEvidence(current => ({ ...current, notes: event.target.value }))}
            placeholder="Brief notes (optional)"
            className="h-10 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          />
          <Button onClick={addEvidence} disabled={!newEvidence.title.trim()} className="h-10 bg-teal-800 hover:bg-teal-700">
            <Plus className="mr-1.5 h-4 w-4" />Add evidence
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EVIDENCE_COLOURS.map(color => (
            <button
              key={color.value}
              type="button"
              onClick={() => setNewEvidence(current => ({ ...current, color: color.value }))}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${newEvidence.color === color.value ? 'border-zinc-900 ring-2 ring-zinc-200' : 'border-zinc-200 hover:border-zinc-400'}`}
            >
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color.value }} />
              {color.name}
            </button>
          ))}
        </div>
      </section>

      {record.evidence.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {record.evidence.map((evidence, index) => (
            <article key={evidence.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-zinc-500">{evidenceCode(index)}</span>
                <button type="button" onClick={() => deleteEvidence(evidence.id)} className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${evidence.title}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input value={evidence.title} onChange={event => updateEvidence(evidence.id, { title: event.target.value })} aria-label={`${evidenceCode(index)} title`} className="w-full border-0 border-b border-zinc-200 pb-1.5 text-sm font-semibold outline-none focus:border-teal-700" />
              <input value={evidence.reference} onChange={event => updateEvidence(evidence.id, { reference: event.target.value })} aria-label={`${evidenceCode(index)} reference`} placeholder="Reference / date" className="mt-3 w-full border-0 border-b border-zinc-100 pb-1.5 text-xs text-zinc-600 outline-none focus:border-teal-700" />
              <textarea value={evidence.notes} onChange={event => updateEvidence(evidence.id, { notes: event.target.value })} aria-label={`${evidenceCode(index)} notes`} placeholder="Evidence details or assessor notes" rows={2} className="mt-3 w-full resize-none rounded-md bg-zinc-50 p-2 text-xs outline-none ring-1 ring-zinc-100 focus:ring-2 focus:ring-teal-200" />
              <div className="mt-3 flex gap-1.5">
                {EVIDENCE_COLOURS.map(color => (
                  <button key={color.value} type="button" onClick={() => updateEvidence(evidence.id, { color: color.value })} aria-label={`Set ${evidence.title} to ${color.name}`} className={`h-5 w-5 rounded-full border-2 transition ${evidence.color === color.value ? 'scale-110 border-zinc-900' : 'border-white hover:scale-110'}`} style={{ backgroundColor: color.value }} />
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center text-sm text-zinc-500">
          Add the first evidence piece above. Each one will become a coloured tile in the mapping board.
        </div>
      )}
    </div>
  );

  const renderMapping = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-800">Landscape workspace</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Map evidence to unit requirements</h2>
          <p className="mt-1 text-sm text-zinc-600">Drag a tile onto a requirement, or select a tile then click a mapping cell. A tile can be used more than once.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">{coveredRows} / {requirementRows.length} directly covered</Badge>
          {selectedEvidence && <Badge className="bg-zinc-900 text-white">Selected: {selectedEvidence.title}</Badge>}
        </div>
      </div>
      {!record.evidence.length && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add at least one evidence item in the Evidence log before mapping it to this unit.
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-zinc-300 bg-zinc-200 shadow-sm">
        <div className="grid min-w-[980px] grid-cols-[250px_1fr]">
          <aside ref={paletteRef} className="border-r border-zinc-300 bg-zinc-950 p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-300">Evidence palette</p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">Drag evidence to the matrix. Click once to select it for click-to-map mode.</p>
            <div className="mt-4 space-y-3">
              {record.evidence.map((item, index) => (
                <EvidenceTile
                  key={item.id}
                  evidence={item}
                  index={index}
                  selected={item.id === selectedEvidenceId}
                  onSelect={() => setSelectedEvidenceId(current => current === item.id ? null : item.id)}
                  onDragStart={() => setDragEvidenceId(item.id)}
                />
              ))}
              {!record.evidence.length && <p className="rounded border border-dashed border-zinc-700 p-3 text-xs leading-5 text-zinc-500">No evidence logged yet.</p>}
            </div>
          </aside>
          <div className="overflow-x-auto bg-white">
            <table className="w-full min-w-[730px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100">
                  <th className="w-[43%] border-b border-zinc-300 px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">Unit requirement</th>
                  <th className="border-b border-l border-zinc-300 px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">Evidence mapped</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  if (row.kind === 'span') {
                    return <tr key={row.key}><td colSpan={2} className={`border-b border-zinc-300 px-4 py-2.5 ${row.style === 'section' ? 'bg-teal-900 text-xs font-bold uppercase tracking-[0.12em] text-white' : row.style === 'element' ? 'bg-zinc-100 font-bold text-zinc-900' : 'bg-white text-xs italic text-zinc-500'}`}>{row.label}</td></tr>;
                  }
                  const mappedIds = record.mappings[row.key] ?? [];
                  const mapped = mappedIds.map(id => ({ id, evidence: evidenceById.get(id) })).filter((item): item is { id: string; evidence: EvidenceItem } => Boolean(item.evidence));
                  return (
                    <tr key={row.key} className="align-top hover:bg-zinc-50">
                      <td className="border-b border-zinc-200 px-4 py-3 leading-5 text-zinc-800">{row.label}</td>
                      <td
                        onDragOver={event => event.preventDefault()}
                        onDrop={() => onDrop(row.key)}
                        className={`min-h-16 border-b border-l border-zinc-200 px-3 py-2 ${selectedEvidenceId ? 'bg-teal-50/40' : 'bg-white'}`}
                      >
                        {mapped.length ? (
                          <div className="flex flex-wrap gap-2">
                            {mapped.map(({ id, evidence }) => (
                              <div key={id} className="min-w-[155px] max-w-[245px]">
                                <EvidenceTile evidence={evidence} index={record.evidence.findIndex(item => item.id === id)} compact onRemove={() => unmapEvidence(row.key, id)} />
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onDrop(row.key)}
                          disabled={!selectedEvidenceId}
                          aria-label={selectedEvidence ? `Map ${selectedEvidence.title} to ${row.label}` : `Select evidence before mapping to ${row.label}`}
                          className={`mt-1.5 rounded px-2 py-1 text-xs font-medium outline-none transition focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 ${selectedEvidenceId ? 'bg-teal-800 text-white hover:bg-teal-700' : 'text-zinc-400 hover:text-zinc-500'}`}
                        >
                          {selectedEvidenceId ? `Map ${selectedEvidence?.title}` : mapped.length ? 'Add more evidence' : 'Select evidence to map'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {selectedEvidenceId && <button type="button" onClick={() => setSelectedEvidenceId(null)} className="text-xs font-medium text-teal-800 underline underline-offset-4">Clear selected evidence</button>}
    </div>
  );

  const renderGaps = () => (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-800">Evidence gaps</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Interview and oral questions</h2>
          <p className="mt-1 text-sm text-zinc-600">These are requirements without directly mapped evidence. Record how the gap was explored and the assessor’s outcome.</p>
        </div>
        <Badge className={uncoveredRows.length ? 'bg-amber-100 text-amber-900 hover:bg-amber-100' : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100'}>
          {uncoveredRows.length ? `${uncoveredRows.length} gaps identified` : 'All requirements mapped'}
        </Badge>
      </div>
      {uncoveredRows.length ? (
        <div className="space-y-4">
          {uncoveredRows.map(row => {
            const interview = record.interviews[row.key] ?? { question: '', studentResponse: '', assessorNotes: '', outcome: 'pending' as const };
            return (
              <article key={row.key} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-3xl text-sm font-semibold leading-6 text-zinc-900">{row.label}</p>
                  <select value={interview.outcome} onChange={event => updateInterview(row.key, { outcome: event.target.value as InterviewOutcome })} className="h-9 rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs font-medium outline-none focus:border-teal-700">
                    <option value="pending">Pending outcome</option>
                    <option value="resolved">Resolved</option>
                    <option value="not-resolved">Not resolved</option>
                  </select>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <textarea value={interview.question} onChange={event => updateInterview(row.key, { question: event.target.value })} rows={4} placeholder="Interview / oral question prompt" className="resize-none rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" />
                  <textarea value={interview.studentResponse} onChange={event => updateInterview(row.key, { studentResponse: event.target.value })} rows={4} placeholder="Student response / new evidence" className="resize-none rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" />
                  <textarea value={interview.assessorNotes} onChange={event => updateInterview(row.key, { assessorNotes: event.target.value })} rows={4} placeholder="Assessor notes and rationale" className="resize-none rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <Check className="mx-auto h-8 w-8 text-emerald-700" />
          <h3 className="mt-3 font-semibold text-emerald-950">No direct-evidence gaps</h3>
          <p className="mt-1 text-sm text-emerald-800">Every requirement currently has at least one evidence tile mapped to it.</p>
        </div>
      )}
    </div>
  );

  const renderReview = () => (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-teal-800">Pre-finalisation check</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Review the RPL record</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Student', hasStudent ? record.student.name : 'Details incomplete', hasStudent ? 'text-teal-900 bg-teal-50 border-teal-200' : 'text-rose-900 bg-rose-50 border-rose-200'],
          ['Evidence logged', `${record.evidence.length} items`, 'text-indigo-900 bg-indigo-50 border-indigo-200'],
          ['Directly covered', `${coveredRows} of ${requirementRows.length}`, 'text-emerald-900 bg-emerald-50 border-emerald-200'],
          ['Gaps resolved', `${resolvedGaps} of ${uncoveredRows.length}`, 'text-amber-900 bg-amber-50 border-amber-200'],
        ].map(([label, value, classes]) => (
          <article key={label} className={`rounded-xl border p-4 ${classes}`}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">{label}</p>
            <p className="mt-2 text-lg font-bold">{value}</p>
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h3 className="font-semibold text-zinc-900">Requirement coverage</h3>
          <p className="mt-1 text-xs text-zinc-500">A direct evidence mapping is shown below; interview records can be completed in the Gaps screen.</p>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-100">
              <tr><th className="px-5 py-3 text-left text-xs uppercase tracking-[0.1em] text-zinc-600">Requirement</th><th className="px-5 py-3 text-left text-xs uppercase tracking-[0.1em] text-zinc-600">Evidence</th><th className="px-5 py-3 text-left text-xs uppercase tracking-[0.1em] text-zinc-600">Status</th></tr>
            </thead>
            <tbody>
              {requirementRows.map(row => {
                const mapped = (record.mappings[row.key] ?? []).map(id => evidenceById.get(id)).filter((item): item is EvidenceItem => Boolean(item));
                const interview = record.interviews[row.key];
                return <tr key={row.key} className="border-t border-zinc-100 align-top">
                  <td className="px-5 py-3 text-zinc-800">{row.label}</td>
                  <td className="px-5 py-3">{mapped.length ? <div className="flex flex-wrap gap-1.5">{mapped.map(item => <span key={item.id} style={tileStyle(item.color)} className="rounded border-l-4 px-2 py-1 text-xs font-semibold">{item.title}</span>)}</div> : <span className="text-xs text-zinc-400">No direct evidence</span>}</td>
                  <td className="px-5 py-3 text-xs font-medium">{mapped.length ? <span className="text-emerald-700">Mapped</span> : interview ? <span className={interview.outcome === 'resolved' ? 'text-teal-700' : 'text-amber-700'}>{statusForOutcome(interview.outcome)}</span> : <span className="text-amber-700">Gap</span>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderFinal = () => (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-teal-800">Final output</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Final RPL mapping</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Download a landscape, Word-compatible RPL record containing the student details, evidence log, mapping matrix, interview records and printable student/assessor signature boxes.
        </p>
        <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <div className="grid gap-2 sm:grid-cols-2">
            <span><strong>Student:</strong> {record.student.name || 'Not recorded'}</span>
            <span><strong>Student number:</strong> {record.student.studentNumber || 'Not recorded'}</span>
            <span><strong>Trainer / assessor:</strong> {record.student.trainerName || 'Not recorded'}</span>
            <span><strong>Assessment date:</strong> {record.student.assessmentDate || 'Not recorded'}</span>
            <span><strong>Evidence items:</strong> {record.evidence.length}</span>
            <span><strong>Direct mappings:</strong> {coveredRows} of {requirementRows.length}</span>
          </div>
        </div>
        <Button
          onClick={() => { exportRplToWord(unit, record); setExported(true); }}
          disabled={!hasStudent}
          className="mt-6 bg-teal-800 hover:bg-teal-700"
        >
          {exported ? <Check className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
          {exported ? 'Downloaded RPL mapping' : 'Download landscape Word record'}
        </Button>
        {!hasStudent && <p className="mt-2 text-xs text-rose-700">Add the student name and student number before finalising.</p>}
      </section>
      <aside className="rounded-2xl border border-teal-900 bg-teal-950 p-6 text-teal-50 shadow-sm">
        <FileCheck2 className="h-7 w-7 text-teal-300" />
        <h3 className="mt-4 text-lg font-semibold">Ready for signatures</h3>
        <p className="mt-2 text-sm leading-6 text-teal-100">The export includes separate declaration boxes for the student and assessor, with room for their signatures and dates.</p>
      </aside>
    </div>
  );

  const stageContent: Record<Stage, () => ReactElement> = {
    student: renderStudent,
    evidence: renderEvidence,
    mapping: renderMapping,
    gaps: renderGaps,
    review: renderReview,
    final: renderFinal,
  };

  return (
    <div className="space-y-6" data-testid="rpl-workflow">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-teal-800">{unit.code}</span>
            <Badge variant="outline" className="border-zinc-300 text-zinc-600">RPL workflow</Badge>
          </div>
          <h1 className="mt-1 text-lg font-bold text-zinc-900">{unit.title}</h1>
        </div>
        <div className="flex items-center gap-4 text-right text-xs leading-5 text-zinc-500">
          <div>
            <span className="block font-semibold text-zinc-700">{record.student.name || 'No student selected'}</span>
            <span>{record.student.studentNumber || 'Student number required'}</span>
          </div>
          {onOpenAssessmentMapping && (
            <button type="button" onClick={onOpenAssessmentMapping} className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-500 hover:text-zinc-900">
              Assessment mapping
            </button>
          )}
        </div>
      </header>

      <nav aria-label="RPL workflow steps" className="overflow-x-auto pb-1">
        <ol className="flex min-w-[710px] items-center">
          {STAGES.map((item, index) => {
            const Icon = item.icon;
            const active = item.id === stage;
            const complete = index < stageIndex;
            return <li key={item.id} className="flex flex-1 items-center last:flex-none">
              <button
                type="button"
                onClick={() => setStage(item.id)}
                className={`group flex min-w-[100px] flex-col items-center gap-1.5 text-center outline-none ${active ? 'text-teal-900' : complete ? 'text-teal-700' : 'text-zinc-500'}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition ${active ? 'border-teal-800 bg-teal-800 text-white shadow-sm' : complete ? 'border-teal-200 bg-teal-100 text-teal-800' : 'border-zinc-300 bg-white text-zinc-500 group-hover:border-teal-400'}`}>
                  {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="text-[11px] font-semibold leading-4">{item.short}</span>
              </button>
              {index < STAGES.length - 1 && <span className={`mx-1 h-px flex-1 ${index < stageIndex ? 'bg-teal-300' : 'bg-zinc-300'}`} />}
            </li>;
          })}
        </ol>
      </nav>

      <section>{stageContent[stage]()}</section>

      <footer className="flex items-center justify-between border-t border-zinc-300 pt-5">
        <Button variant="outline" onClick={goPrevious} disabled={stageIndex === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        <span className="text-xs font-medium text-zinc-500">Step {stageIndex + 1} of {STAGES.length}</span>
        <Button onClick={goNext} disabled={stageIndex === STAGES.length - 1 || (stage === 'student' && !hasStudent)} className="bg-zinc-900 hover:bg-zinc-700">
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
}