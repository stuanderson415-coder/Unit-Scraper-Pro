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
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { buildRows } from '@/lib/unit-rows';
import { exportRplToWord } from '@/lib/export-rpl-doc';
import {
  EVIDENCE_TYPES,
  EVIDENCE_CLASSIFICATIONS,
  createEmptyRplRecord,
  evidenceCode,
  hasRplRecord,
  listRplStudents,
  loadRplRecordForStudent,
  loadRplRecord,
  newEvidenceId,
  persistRplRecord,
  type EvidenceItem,
  type EvidenceClassification,
  type EvidenceSubtype,
  type InterviewOutcome,
  type InterviewRecord,
  type RplRecord,
  type StudentRecordSummary,
  type StudentDetails,
  studentDisplayName,
} from '@/lib/rpl-state';

export type RplStage = 'student' | 'evidence' | 'mapping' | 'gaps' | 'review' | 'final';

const STAGES: Array<{ id: RplStage; label: string; short: string; icon: typeof UserRound }> = [
  { id: 'student', label: 'Student details', short: 'Student', icon: UserRound },
  { id: 'evidence', label: 'Evidence log', short: 'Evidence', icon: ListPlus },
  { id: 'mapping', label: 'RPL mapping', short: 'Mapping', icon: GripVertical },
  { id: 'gaps', label: 'Gaps interview', short: 'Gaps', icon: MessageSquareText },
  { id: 'review', label: 'Review', short: 'Review', icon: ClipboardCheck },
  { id: 'final', label: 'Outcome & sign-off', short: 'Outcome', icon: FileCheck2 },
];

type NewEvidenceDraft = Omit<EvidenceItem, 'id'>;

const DEFAULT_NEW_EVIDENCE: NewEvidenceDraft = {
  title: '',
  reference: '',
  notes: '',
  type: EVIDENCE_TYPES[0].value,
  classifications: [],
  subtypes: [],
};

function statusForOutcome(outcome: InterviewOutcome) {
  if (outcome === 'resolved') return 'Resolved';
  if (outcome === 'not-resolved') return 'Not resolved';
  return 'Pending';
}

function tileStyle(type: EvidenceItem['type']) {
  const palette = EVIDENCE_TYPES.find(item => item.value === type) ?? EVIDENCE_TYPES[0];
  return { backgroundColor: palette.soft, borderColor: palette.color, color: palette.color };
}

function EvidenceTile({
  evidence,
  index,
  compact = false,
  selected = false,
  onSelect,
  onDragStart,
  onDragEnd,
  onRemove,
}: {
  evidence: EvidenceItem;
  index: number;
  compact?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
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
      onDragEnd={onDragEnd}
      className={`group relative block h-full min-h-10 w-full rounded-md border-l-4 px-2 py-1.5 text-left shadow-[2px_2px_0_rgba(24,24,27,0.16)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[3px_3px_0_rgba(24,24,27,0.2)] active:scale-[0.98] ${selected ? 'ring-2 ring-teal-900 ring-offset-2' : ''} ${compact ? 'text-[11px]' : 'text-xs'}`}
      style={tileStyle(evidence.type)}
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
  return <label className="mb-1 block text-xs font-bold uppercase tracking-[0.11em] text-zinc-600">{children}</label>;
}

function EvidenceClassificationFields({
  classifications,
  subtypes,
  onChange,
  compact = false,
}: {
  classifications: EvidenceClassification[];
  subtypes: EvidenceSubtype[];
  onChange: (patch: Pick<EvidenceItem, 'classifications' | 'subtypes'>) => void;
  compact?: boolean;
}) {
  const toggleClassification = (classification: EvidenceClassification) => {
    const selected = classifications.includes(classification)
      ? classifications.filter(item => item !== classification)
      : [...classifications, classification];
    const allowedSubtypes = new Set(
      EVIDENCE_CLASSIFICATIONS
        .filter(group => selected.includes(group.value))
        .flatMap(group => group.subtypes.map(subtype => subtype.value)),
    );
    onChange({ classifications: selected, subtypes: subtypes.filter(subtype => allowedSubtypes.has(subtype)) });
  };
  const toggleSubtype = (subtype: EvidenceSubtype) => {
    onChange({
      classifications,
      subtypes: subtypes.includes(subtype) ? subtypes.filter(item => item !== subtype) : [...subtypes, subtype],
    });
  };
  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      <div className="flex flex-wrap gap-2">
        {EVIDENCE_CLASSIFICATIONS.map(group => (
          <label key={group.value} title={group.description} className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold transition ${classifications.includes(group.value) ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-zinc-200 bg-white text-zinc-600 hover:border-teal-300'}`}>
            <input type="checkbox" checked={classifications.includes(group.value)} onChange={() => toggleClassification(group.value)} className="accent-teal-700" />
            {group.name}
          </label>
        ))}
      </div>
      {classifications.length > 0 && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {EVIDENCE_CLASSIFICATIONS.filter(group => classifications.includes(group.value)).flatMap(group =>
            group.subtypes.map(subtype => (
              <label key={subtype.value} className="flex cursor-pointer items-start gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] leading-4 text-zinc-700 hover:border-teal-300">
                <input type="checkbox" checked={subtypes.includes(subtype.value)} onChange={() => toggleSubtype(subtype.value)} className="mt-0.5 accent-teal-700" />
                {subtype.name}
              </label>
            )),
          )}
        </div>
      )}
    </div>
  );
}

function withPreRplEvidence(current: RplRecord): RplRecord {
  const checklist = current.student.preRplChecklist;
  const candidates: Array<{ provided: boolean; title: string; reference: string; sourceKey: NonNullable<EvidenceItem['sourceKey']> }> = [
    { provided: checklist.cvResumeProvided, title: 'CV / résumé', reference: checklist.cvResumeFileName, sourceKey: 'pre-rpl-cv' },
    { provided: checklist.academicTranscriptProvided, title: 'Academic transcript', reference: checklist.academicTranscriptFileName, sourceKey: 'pre-rpl-transcript' },
    { provided: checklist.positionDescriptionProvided, title: 'Current position description', reference: checklist.positionDescriptionFileName, sourceKey: 'pre-rpl-position-description' },
  ];
  const additions = candidates
    .filter(candidate => candidate.provided && !current.evidence.some(item => item.sourceKey === candidate.sourceKey))
    .map(candidate => ({
      id: newEvidenceId(),
      title: candidate.title,
      reference: candidate.reference,
      notes: 'Provided during Pre-RPL intake',
      type: 'reports' as const,
      classifications: ['indirect'] as EvidenceClassification[],
      subtypes: ['work-sample-portfolio'] as EvidenceSubtype[],
      sourceKey: candidate.sourceKey,
    }));
  return additions.length ? { ...current, evidence: [...current.evidence, ...additions] } : current;
}

export function RplWorkflow({ unit, studentNumber, prefill, initialStage = 'student', onOpenAssessmentMapping }: { unit: UnitOfCompetency; studentNumber?: string; prefill?: StudentDetails; initialStage?: RplStage; onOpenAssessmentMapping?: () => void }) {
  const hasPrefill = Boolean(prefill?.surname || prefill?.givenNames || prefill?.studentNumber);
  const [record, setRecord] = useState<RplRecord>(() => {
    const loaded = studentNumber
      ? loadRplRecordForStudent(unit.code, studentNumber)
      : hasPrefill
        ? createEmptyRplRecord()
        : loadRplRecord(unit.code);
    const merged = prefill ? { ...loaded, student: { ...loaded.student, ...prefill } } : loaded;
    return withPreRplEvidence(merged);
  });
  const [activeRecordStudentNumber, setActiveRecordStudentNumber] = useState(
    () => studentNumber ?? (hasPrefill ? 'draft' : (loadRplRecord(unit.code).student.studentNumber.trim() || 'draft')),
  );
  const [savedStudents, setSavedStudents] = useState<StudentRecordSummary[]>(() => listRplStudents(unit.code));
  const [recordConflict, setRecordConflict] = useState<string | null>(null);
  const [stage, setStage] = useState<RplStage>(initialStage);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [dragEvidenceId, setDragEvidenceId] = useState<string | null>(null);
  const [dragTargetRowKey, setDragTargetRowKey] = useState<string | null>(null);
  const [newEvidence, setNewEvidence] = useState(DEFAULT_NEW_EVIDENCE);
  const [exported, setExported] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentStudentNumber = record.student.studentNumber.trim() || 'draft';
    if (currentStudentNumber === activeRecordStudentNumber) {
      persistRplRecord(unit.code, record, activeRecordStudentNumber === 'draft' ? '' : activeRecordStudentNumber);
      setSavedStudents(listRplStudents(unit.code));
    }
  }, [activeRecordStudentNumber, record, unit.code]);

  useEffect(() => {
    if (import.meta.env.DEV) setStage(initialStage);
  }, [initialStage]);

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
  const studentName = studentDisplayName(record.student);
  const hasStudent = Boolean(record.student.surname.trim() && record.student.givenNames.trim() && record.student.studentNumber.trim());

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

  const goNext = () => {
    if (stage === 'student') {
      saveStudentAndContinue();
      return;
    }
    setStage(STAGES[Math.min(stageIndex + 1, STAGES.length - 1)].id);
  };
  const goPrevious = () => setStage(STAGES[Math.max(stageIndex - 1, 0)].id);
  const devSkip = (direction: -1 | 1) => {
    setStage(STAGES[Math.max(0, Math.min(stageIndex + direction, STAGES.length - 1))].id);
  };

  const saveProgress = () => {
    persistRplRecord(unit.code, record, activeRecordStudentNumber === 'draft' ? '' : activeRecordStudentNumber);
    setSavedStudents(listRplStudents(unit.code));
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 1600);
  };

  const onDrop = (rowKey: string) => {
    const evidenceId = dragEvidenceId ?? selectedEvidenceId;
    if (!evidenceId) return;
    mapEvidence(rowKey, evidenceId);
    setDragEvidenceId(null);
    setDragTargetRowKey(null);
  };

  const saveStudentAndContinue = () => {
    const nextStudentNumber = record.student.studentNumber.trim();
    if (!hasStudent) return;
    if (nextStudentNumber !== activeRecordStudentNumber && hasRplRecord(unit.code, nextStudentNumber)) {
      setRecordConflict(nextStudentNumber);
      return;
    }
    const nextRecord = withPreRplEvidence(record);
    setRecord(nextRecord);
    setActiveRecordStudentNumber(nextStudentNumber);
    persistRplRecord(unit.code, nextRecord, nextStudentNumber);
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
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-teal-800">Start an RPL record</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">Student details</h2>
        <p className="mt-1 max-w-xl text-sm leading-5 text-zinc-600">
          This record is saved in this browser against the unit and student number, so you can return to the RPL assessment later.
        </p>
        {savedStudents.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
            <span className="mr-1 text-xs font-semibold text-zinc-600">Open a saved student:</span>
            {savedStudents.map(student => (
              <button key={student.studentNumber} type="button" onClick={() => openSavedStudent(student.studentNumber)} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${student.studentNumber === activeRecordStudentNumber ? 'border-teal-700 bg-teal-100 text-teal-900' : 'border-zinc-300 bg-white text-zinc-700 hover:border-teal-400'}`}>
                {studentDisplayName(student) || 'Unnamed'} · {student.studentNumber}
              </button>
            ))}
            <button type="button" onClick={startNewStudent} className="rounded-full border border-dashed border-zinc-400 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-teal-500 hover:text-teal-800">New record</button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <FieldLabel>Surname</FieldLabel>
            <input
              value={record.student.surname}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, surname: event.target.value } }))}
              placeholder="e.g. Morgan"
              className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2.5 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <FieldLabel>Given names</FieldLabel>
            <input
              value={record.student.givenNames}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, givenNames: event.target.value } }))}
              placeholder="e.g. Alex"
              className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2.5 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <FieldLabel>Student number</FieldLabel>
            <input
              value={record.student.studentNumber}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, studentNumber: event.target.value } }))}
              placeholder="e.g. 12345678"
              className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2.5 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <FieldLabel>Trainer / assessor</FieldLabel>
            <input
              value={record.student.trainerName}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, trainerName: event.target.value } }))}
              placeholder="e.g. Jordan Lee"
              className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2.5 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <FieldLabel>Parent Qualification</FieldLabel>
            <input
              value={record.student.organisation}
              onChange={event => updateRecord(current => ({ ...current, student: { ...current.student, organisation: event.target.value } }))}
              placeholder="e.g. Your RTO"
              className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-2.5 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </div>
          <div>
            <FieldLabel>Assessment date (DD/MM/YYYY)</FieldLabel>
            <DatePickerInput
              value={record.student.assessmentDate}
              onChange={assessmentDate => updateRecord(current => ({ ...current, student: { ...current.student, assessmentDate } }))}
              ariaLabel="Assessment date"
              className="bg-zinc-50"
            />
          </div>
        </div>
        {recordConflict && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p>A saved record already exists for student number <strong>{recordConflict}</strong>. Open the saved record to avoid overwriting it, or intentionally replace it with the details above.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openSavedStudent(recordConflict)}>Open saved record</Button>
              <Button size="sm" className="bg-amber-700 hover:bg-amber-600" onClick={replaceSavedStudent}>Replace saved record</Button>
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-end">
          <Button onClick={saveStudentAndContinue} disabled={!hasStudent} className="bg-teal-800 hover:bg-teal-700">
            Save and continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
      <aside className="rounded-xl border border-teal-950 bg-teal-900 p-4 text-teal-50 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">RPL record</span>
        <p className="mt-3 text-base font-semibold leading-6">Evidence is recorded once, then mapped to every requirement it supports.</p>
        <ol className="mt-5 space-y-3 text-sm leading-5 text-teal-100">
          <li><span className="mr-2 font-mono text-teal-300">01</span>Add the student's details.</li>
          <li><span className="mr-2 font-mono text-teal-300">02</span>Log each piece of evidence and its reference.</li>
          <li><span className="mr-2 font-mono text-teal-300">03</span>Map evidence, resolve gaps, then export the final record.</li>
        </ol>
      </aside>
    </div>
  );

  const renderEvidence = () => (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-teal-800">Evidence register</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">Log a piece of evidence</h2>
          </div>
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800">{record.evidence.length} logged</Badge>
        </div>
        <div className="mt-4 grid gap-2.5 lg:grid-cols-[1.1fr_0.9fr_1.1fr_1fr_auto]">
          <input
            value={newEvidence.title}
            onChange={event => setNewEvidence(current => ({ ...current, title: event.target.value }))}
            onKeyDown={event => { if (event.key === 'Enter') addEvidence(); }}
            placeholder="Evidence title"
             className="h-9 rounded-md border border-zinc-300 px-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          />
          <select
            value={newEvidence.type}
            onChange={event => setNewEvidence(current => ({ ...current, type: event.target.value as EvidenceItem['type'] }))}
            aria-label="Evidence type"
            className="h-9 rounded-md border border-zinc-300 bg-white px-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          >
            {EVIDENCE_TYPES.map(type => <option key={type.value} value={type.value}>{type.name}</option>)}
          </select>
          <input
            value={newEvidence.reference}
            onChange={event => setNewEvidence(current => ({ ...current, reference: event.target.value }))}
            placeholder="Reference / date"
             className="h-9 rounded-md border border-zinc-300 px-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          />
          <input
            value={newEvidence.notes}
            onChange={event => setNewEvidence(current => ({ ...current, notes: event.target.value }))}
            placeholder="Brief notes (optional)"
             className="h-9 rounded-md border border-zinc-300 px-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
          />
           <Button onClick={addEvidence} disabled={!newEvidence.title.trim()} className="h-9 bg-teal-800 hover:bg-teal-700">
            <Plus className="mr-1.5 h-4 w-4" />Add evidence
          </Button>
        </div>
        <EvidenceClassificationFields
          classifications={newEvidence.classifications}
          subtypes={newEvidence.subtypes}
          onChange={patch => setNewEvidence(current => ({ ...current, ...patch }))}
        />
      </section>

      {record.evidence.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
           {record.evidence.map((evidence, index) => (
             <article key={evidence.id} className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
               <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-zinc-500">{evidenceCode(index)}</span>
                <button type="button" onClick={() => deleteEvidence(evidence.id)} className="rounded p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${evidence.title}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <input value={evidence.title} onChange={event => updateEvidence(evidence.id, { title: event.target.value })} aria-label={`${evidenceCode(index)} title`} className="w-full border-0 border-b border-zinc-200 pb-1.5 text-sm font-semibold outline-none focus:border-teal-700" />
               <input value={evidence.reference} onChange={event => updateEvidence(evidence.id, { reference: event.target.value })} aria-label={`${evidenceCode(index)} reference`} placeholder="Reference / date" className="mt-2 w-full border-0 border-b border-zinc-100 pb-1.5 text-xs text-zinc-600 outline-none focus:border-teal-700" />
               <textarea value={evidence.notes} onChange={event => updateEvidence(evidence.id, { notes: event.target.value })} aria-label={`${evidenceCode(index)} notes`} placeholder="Evidence details or assessor notes" rows={2} className="mt-2 w-full resize-none rounded-md bg-zinc-50 p-2 text-xs outline-none ring-1 ring-zinc-100 focus:ring-2 focus:ring-teal-200" />
               <select value={evidence.type} onChange={event => updateEvidence(evidence.id, { type: event.target.value as EvidenceItem['type'] })} aria-label={`${evidenceCode(index)} evidence type`} className="mt-2 h-8 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 text-xs font-medium text-zinc-700 outline-none focus:border-teal-700">
                 {EVIDENCE_TYPES.map(type => <option key={type.value} value={type.value}>{type.name}</option>)}
               </select>
               <EvidenceClassificationFields
                 compact
                 classifications={evidence.classifications}
                 subtypes={evidence.subtypes}
                 onChange={patch => updateEvidence(evidence.id, patch)}
               />
            </article>
          ))}
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center text-sm text-zinc-500">
          Add the first evidence piece above. Each one will become a labelled tile in the mapping board.
        </div>
      )}
    </div>
  );

  const renderMapping = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-teal-800">Landscape workspace</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">Map evidence to unit requirements</h2>
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
      <div className="w-full max-w-full overflow-x-auto rounded-xl border border-zinc-300 bg-zinc-200 shadow-sm">
        <div className="grid min-w-[900px] grid-cols-[220px_1fr]">
          <aside ref={paletteRef} className="border-r border-teal-800 bg-teal-900 p-3 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-200">Evidence palette</p>
            <p className="mt-1.5 text-xs leading-5 text-teal-100">Drag evidence to the matrix. Click once to select it for click-to-map mode.</p>
            <div className="mt-3 space-y-2">
              {record.evidence.map((item, index) => (
                <EvidenceTile
                  key={item.id}
                  evidence={item}
                  index={index}
                  selected={item.id === selectedEvidenceId}
                  onSelect={() => setSelectedEvidenceId(current => current === item.id ? null : item.id)}
                  onDragStart={() => setDragEvidenceId(item.id)}
                  onDragEnd={() => { setDragEvidenceId(null); setDragTargetRowKey(null); }}
                />
              ))}
              {!record.evidence.length && <p className="rounded border border-dashed border-teal-600 p-3 text-xs leading-5 text-teal-200">No evidence logged yet.</p>}
            </div>
          </aside>
          <div className="overflow-x-auto bg-white">
             <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-100">
                   <th className="w-[43%] border-b border-zinc-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">Unit requirement</th>
                   <th className="border-b border-l border-zinc-300 px-3 py-2 text-left text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">Evidence mapped</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  if (row.kind === 'span') {
                    return <tr key={row.key}><td colSpan={2} className={`border-b border-zinc-300 px-3 py-2 ${row.style === 'section' ? 'bg-teal-900 text-xs font-bold uppercase tracking-[0.12em] text-white' : row.style === 'element' ? 'bg-zinc-100 font-bold text-zinc-900' : 'bg-white text-xs italic text-zinc-500'}`}>{row.label}</td></tr>;
                  }
                  const mappedIds = record.mappings[row.key] ?? [];
                  const mapped = mappedIds.map(id => ({ id, evidence: evidenceById.get(id) })).filter((item): item is { id: string; evidence: EvidenceItem } => Boolean(item.evidence));
                  return (
                    <tr key={row.key} className="align-top hover:bg-zinc-50">
                       <td className="border-b border-zinc-200 px-3 py-2.5 leading-5 text-zinc-800">{row.label}</td>
                      <td
                        onDragEnter={() => setDragTargetRowKey(row.key)}
                        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragTargetRowKey(null); }}
                        onDragOver={event => event.preventDefault()}
                        onDrop={() => onDrop(row.key)}
                         className={`min-h-14 border-b border-l border-zinc-200 px-2.5 py-1.5 transition-all duration-200 ${dragTargetRowKey === row.key ? 'bg-teal-100 ring-2 ring-inset ring-teal-500' : selectedEvidenceId ? 'bg-teal-50/40' : 'bg-white'}`}
                      >
                        {mapped.length ? (
                           <div className="flex min-h-12 flex-wrap items-stretch gap-1.5">
                            {mapped.map(({ id, evidence }) => (
                               <div key={id} className="min-w-[145px] max-w-[225px] flex-1 animate-in slide-in-from-left-2 fade-in duration-200">
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
                           className={`mt-1 rounded px-2 py-1 text-xs font-medium outline-none transition focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 ${selectedEvidenceId ? 'bg-teal-800 text-white hover:bg-teal-700' : 'text-zinc-400 hover:text-zinc-500'}`}
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-teal-800">Evidence gaps</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">Interview and oral questions</h2>
          <p className="mt-1 text-sm text-zinc-600">These are requirements without directly mapped evidence. Record how the gap was explored and the assessor’s outcome.</p>
        </div>
        <Badge className={uncoveredRows.length ? 'bg-amber-100 text-amber-900 hover:bg-amber-100' : 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100'}>
          {uncoveredRows.length ? `${uncoveredRows.length} gaps identified` : 'All requirements mapped'}
        </Badge>
      </div>
      {uncoveredRows.length ? (
        <div className="space-y-3">
          {uncoveredRows.map(row => {
            const interview = record.interviews[row.key] ?? { question: '', studentResponse: '', assessorNotes: '', outcome: 'pending' as const };
            return (
              <article key={row.key} className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-3xl text-sm font-semibold leading-6 text-zinc-900">{row.label}</p>
                  <select value={interview.outcome} onChange={event => updateInterview(row.key, { outcome: event.target.value as InterviewOutcome })} className="h-9 rounded-md border border-zinc-300 bg-zinc-50 px-2 text-xs font-medium outline-none focus:border-teal-700">
                    <option value="pending">Pending outcome</option>
                    <option value="resolved">Resolved</option>
                    <option value="not-resolved">Not resolved</option>
                  </select>
                </div>
                <div className="mt-3 grid gap-2.5 lg:grid-cols-3">
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
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-teal-800">Pre-finalisation check</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">Review the RPL record</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Student', hasStudent ? studentName : 'Details incomplete', hasStudent ? 'text-teal-900 bg-teal-50 border-teal-200' : 'text-rose-900 bg-rose-50 border-rose-200'],
          ['Evidence logged', `${record.evidence.length} items`, 'text-indigo-900 bg-indigo-50 border-indigo-200'],
          ['Directly covered', `${coveredRows} of ${requirementRows.length}`, 'text-emerald-900 bg-emerald-50 border-emerald-200'],
          ['Gaps resolved', `${resolvedGaps} of ${uncoveredRows.length}`, 'text-amber-900 bg-amber-50 border-amber-200'],
        ].map(([label, value, classes]) => (
            <article key={label} className={`rounded-xl border p-3 ${classes}`}>
            <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-70">{label}</p>
             <p className="mt-1.5 text-lg font-bold">{value}</p>
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
         <div className="border-b border-zinc-200 px-4 py-3">
          <h3 className="font-semibold text-zinc-900">Requirement coverage</h3>
          <p className="mt-1 text-xs text-zinc-500">A direct evidence mapping is shown below; interview records can be completed in the Gaps screen.</p>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
             <thead className="sticky top-0 bg-zinc-100">
               <tr><th className="px-4 py-2.5 text-left text-xs uppercase tracking-[0.1em] text-zinc-600">Requirement</th><th className="px-4 py-2.5 text-left text-xs uppercase tracking-[0.1em] text-zinc-600">Evidence</th><th className="px-4 py-2.5 text-left text-xs uppercase tracking-[0.1em] text-zinc-600">Status</th></tr>
            </thead>
            <tbody>
              {requirementRows.map(row => {
                const mapped = (record.mappings[row.key] ?? []).map(id => evidenceById.get(id)).filter((item): item is EvidenceItem => Boolean(item));
                const interview = record.interviews[row.key];
                return <tr key={row.key} className="border-t border-zinc-100 align-top">
                   <td className="px-4 py-2.5 text-zinc-800">{row.label}</td>
                   <td className="px-4 py-2.5">{mapped.length ? <div className="flex flex-wrap gap-1.5">{mapped.map(item => <span key={item.id} style={tileStyle(item.type)} className="rounded border-l-4 px-2 py-1 text-xs font-semibold">{item.title}</span>)}</div> : <span className="text-xs text-zinc-400">No direct evidence</span>}</td>
                   <td className="px-4 py-2.5 text-xs font-medium">{mapped.length ? <span className="text-emerald-700">Mapped</span> : interview ? <span className={interview.outcome === 'resolved' ? 'text-teal-700' : 'text-amber-700'}>{statusForOutcome(interview.outcome)}</span> : <span className="text-amber-700">Gap</span>}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  const renderFinal = () => (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-teal-800">Final output</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-900">RPL outcome and sign-off</h2>
        <p className="mt-2 max-w-2xl text-sm leading-5 text-zinc-600">
           Record the assessment outcome, complete the digital declarations, then download the final landscape Word report.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">RPL outcome</span>
            <select
              value={record.finalisation.outcome}
              onChange={event => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, outcome: event.target.value as typeof current.finalisation.outcome } }))}
              className="h-10 rounded-md border border-zinc-300 bg-white px-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            >
              <option value="pending">Decision pending</option>
              <option value="full-rpl">Full RPL granted</option>
              <option value="partial-rpl">Partial RPL granted</option>
              <option value="not-granted">RPL not granted</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-600">Outcome notes / conditions</span>
            <input
              value={record.finalisation.outcomeNotes}
              onChange={event => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, outcomeNotes: event.target.value } }))}
              placeholder="Record the decision rationale, partial-RPL conditions, or next steps"
              className="h-10 rounded-md border border-zinc-300 bg-white px-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            />
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          <div className="grid gap-2 sm:grid-cols-2">
             <span><strong>Student:</strong> {studentName || 'Not recorded'}</span>
            <span><strong>Student number:</strong> {record.student.studentNumber || 'Not recorded'}</span>
            <span><strong>Trainer / assessor:</strong> {record.student.trainerName || 'Not recorded'}</span>
            <span><strong>Assessment date:</strong> {record.student.assessmentDate || 'Not recorded'}</span>
            <span><strong>Evidence items:</strong> {record.evidence.length}</span>
            <span><strong>Direct mappings:</strong> {coveredRows} of {requirementRows.length}</span>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3 text-xs text-zinc-700">
            <p className="font-semibold text-teal-900">Student digital declaration</p>
            <p className="mt-1 text-[11px]">Typing the name below confirms the evidence and responses belong to the student.</p>
            <input value={record.finalisation.studentSignature} onChange={event => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, studentSignature: event.target.value } }))} placeholder="Student full name" className="mt-3 h-9 w-full rounded-md border border-teal-200 bg-white px-2.5 text-sm outline-none focus:border-teal-700" />
            <DatePickerInput value={record.finalisation.studentSignatureDate} onChange={studentSignatureDate => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, studentSignatureDate } }))} ariaLabel="Student signature date" className="mt-2 h-9" />
          </div>
          <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3 text-xs text-zinc-700">
            <p className="font-semibold text-teal-900">Assessor digital declaration</p>
            <p className="mt-1 text-[11px]">Typing the name below confirms the assessment has been reviewed and finalised.</p>
            <input value={record.finalisation.assessorSignature} onChange={event => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, assessorSignature: event.target.value } }))} placeholder="Assessor full name" className="mt-3 h-9 w-full rounded-md border border-teal-200 bg-white px-2.5 text-sm outline-none focus:border-teal-700" />
            <DatePickerInput value={record.finalisation.assessorSignatureDate} onChange={assessorSignatureDate => updateRecord(current => ({ ...current, finalisation: { ...current.finalisation, assessorSignatureDate } }))} ariaLabel="Assessor signature date" className="mt-2 h-9" />
          </div>
        </div>
        <Button
          onClick={async () => { await exportRplToWord(unit, record); setExported(true); }}
          disabled={!hasStudent || record.finalisation.outcome === 'pending'}
           className="mt-4 bg-teal-800 hover:bg-teal-700"
        >
          {exported ? <Check className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
          {exported ? 'Downloaded RPL mapping' : 'Download landscape Word document'}
        </Button>
        {!hasStudent && <p className="mt-2 text-xs text-rose-700">Add the student name and student number before finalising.</p>}
        {hasStudent && record.finalisation.outcome === 'pending' && <p className="mt-2 text-xs text-amber-700">Select the final RPL outcome before downloading the report.</p>}
      </section>
      <aside className="rounded-xl border border-teal-900 bg-teal-950 p-4 text-teal-50 shadow-sm">
        <FileCheck2 className="h-7 w-7 text-teal-300" />
        <h3 className="mt-3 text-lg font-semibold">Ready for signatures</h3>
        <p className="mt-1.5 text-sm leading-5 text-teal-100">The export includes separate declaration boxes for the student and assessor, with room for their signatures and dates.</p>
      </aside>
    </div>
  );

  const stageContent: Record<RplStage, () => ReactElement> = {
    student: renderStudent,
    evidence: renderEvidence,
    mapping: renderMapping,
    gaps: renderGaps,
    review: renderReview,
    final: renderFinal,
  };

  return (
    <div className="space-y-4" data-testid="rpl-workflow">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-teal-800">{unit.code}</span>
            <Badge variant="outline" className="border-zinc-300 text-zinc-600">RPL workflow</Badge>
          </div>
           <h1 className="mt-1 text-base font-bold text-zinc-900">{unit.title}</h1>
        </div>
        <div className="flex items-center gap-3 text-right text-xs leading-5 text-zinc-500">
          {import.meta.env.DEV && (
            <div className="flex items-center gap-1 rounded-md border border-dashed border-amber-400 bg-amber-50 p-1 text-amber-900" title="Development-only stage navigation">
              <span className="px-1 text-[10px] font-bold uppercase">Dev</span>
              <button type="button" onClick={() => devSkip(-1)} disabled={stageIndex === 0} className="rounded p-1 hover:bg-amber-100 disabled:opacity-30" aria-label="Developer: previous stage"><ArrowLeft className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => devSkip(1)} disabled={stageIndex === STAGES.length - 1} className="rounded p-1 hover:bg-amber-100 disabled:opacity-30" aria-label="Developer: next stage"><ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <div>
            <span className="block font-semibold text-zinc-700">{studentName || 'No student selected'}</span>
            <span>{record.student.studentNumber || 'Student number required'}</span>
          </div>
          {onOpenAssessmentMapping && (
            <button type="button" onClick={onOpenAssessmentMapping} className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-zinc-500 hover:text-zinc-900">
              Assessment mapping
            </button>
          )}
        </div>
      </header>

      <nav aria-label="RPL workflow steps" className="pb-1">
        <ol className="grid grid-cols-3 gap-1 sm:flex sm:items-center">
          {STAGES.map((item, index) => {
            const Icon = item.icon;
            const active = item.id === stage;
            const complete = index < stageIndex;
             return <li key={item.id} className="flex min-w-0 flex-col items-center sm:flex-1 sm:flex-row sm:last:flex-none">
              <button
                type="button"
                onClick={() => setStage(item.id)}
                 className={`group flex w-full min-w-0 flex-col items-center gap-1 text-center outline-none sm:w-auto sm:min-w-[88px] ${active ? 'text-teal-900' : complete ? 'text-teal-700' : 'text-zinc-500'}`}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition ${active ? 'border-teal-800 bg-teal-800 text-white shadow-sm' : complete ? 'border-teal-200 bg-teal-100 text-teal-800' : 'border-zinc-300 bg-white text-zinc-500 group-hover:border-teal-400'}`}>
                  {complete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="text-[11px] font-semibold leading-4">{item.short}</span>
              </button>
               {index < STAGES.length - 1 && <span className={`mx-1 hidden h-px flex-1 sm:block ${index < stageIndex ? 'bg-teal-300' : 'bg-zinc-300'}`} />}
            </li>;
          })}
        </ol>
      </nav>

      <section>{stageContent[stage]()}</section>

      <footer className="flex items-center justify-between border-t border-zinc-300 pt-4">
        <Button variant="outline" onClick={goPrevious} disabled={stageIndex === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Previous
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={saveProgress} className="border-teal-300 text-teal-800 hover:bg-teal-50">
            {savedFeedback ? <Check className="mr-2 h-4 w-4" /> : null}
            {savedFeedback ? 'Saved' : 'Save progress'}
          </Button>
          <span className="hidden text-xs font-medium text-zinc-500 sm:inline">Step {stageIndex + 1} of {STAGES.length}</span>
        </div>
        <Button onClick={goNext} disabled={stageIndex === STAGES.length - 1 || (stage === 'student' && !hasStudent)} className="bg-zinc-900 hover:bg-zinc-700">
          Next <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
}