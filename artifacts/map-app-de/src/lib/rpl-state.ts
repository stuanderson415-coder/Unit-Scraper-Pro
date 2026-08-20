export const EVIDENCE_COLOURS = [
  { name: 'Teal',    value: '#0f766e', soft: '#ccfbf1' },
  { name: 'Indigo',  value: '#4338ca', soft: '#e0e7ff' },
  { name: 'Rose',    value: '#be123c', soft: '#ffe4e6' },
  { name: 'Amber',   value: '#b45309', soft: '#fef3c7' },
  { name: 'Emerald', value: '#047857', soft: '#d1fae5' },
  { name: 'Violet',  value: '#7e22ce', soft: '#f3e8ff' },
] as const;

export type InterviewOutcome = 'pending' | 'resolved' | 'not-resolved';

export type StudentDetails = {
  name: string;
  studentNumber: string;
};

export type EvidenceItem = {
  id: string;
  title: string;
  reference: string;
  notes: string;
  color: string;
};

export type InterviewRecord = {
  question: string;
  studentResponse: string;
  assessorNotes: string;
  outcome: InterviewOutcome;
};

export type RplRecord = {
  student: StudentDetails;
  evidence: EvidenceItem[];
  mappings: Record<string, string[]>;
  interviews: Record<string, InterviewRecord>;
};

export type StudentRecordSummary = StudentDetails & {
  updatedAt: string;
};

export function createEmptyRplRecord(): RplRecord {
  return {
    student: { name: '', studentNumber: '' },
    evidence: [],
    mappings: {},
    interviews: {},
  };
}

const lastStudentKey = (unitCode: string) => `map-app-de:rpl:last-student:${unitCode}`;
const studentIndexKey = (unitCode: string) => `map-app-de:rpl:students:${unitCode}`;
const recordKey = (unitCode: string, studentNumber: string) =>
  `map-app-de:rpl:${unitCode}:${studentNumber.trim() || 'draft'}`;

export function loadRplRecord(unitCode: string): RplRecord {
  try {
    const studentNumber = localStorage.getItem(lastStudentKey(unitCode)) ?? '';
    return loadRplRecordForStudent(unitCode, studentNumber);
  } catch {
    return createEmptyRplRecord();
  }
}

export function loadRplRecordForStudent(unitCode: string, studentNumber: string): RplRecord {
  try {
    const saved = localStorage.getItem(recordKey(unitCode, studentNumber));
    if (!saved) return createEmptyRplRecord();
    const parsed = JSON.parse(saved) as Partial<RplRecord>;
    return {
      ...createEmptyRplRecord(),
      ...parsed,
      student: { name: parsed.student?.name ?? '', studentNumber: parsed.student?.studentNumber ?? '' },
      evidence: parsed.evidence ?? [],
      mappings: parsed.mappings ?? {},
      interviews: parsed.interviews ?? {},
    };
  } catch {
    return createEmptyRplRecord();
  }
}

export function hasRplRecord(unitCode: string, studentNumber: string) {
  try {
    return Boolean(studentNumber.trim() && localStorage.getItem(recordKey(unitCode, studentNumber)));
  } catch {
    return false;
  }
}

export function listRplStudents(unitCode: string): StudentRecordSummary[] {
  try {
    const saved = localStorage.getItem(studentIndexKey(unitCode));
    return saved ? JSON.parse(saved) as StudentRecordSummary[] : [];
  } catch {
    return [];
  }
}

export function persistRplRecord(unitCode: string, record: RplRecord, recordStudentNumber?: string) {
  try {
    const studentNumber = (recordStudentNumber ?? record.student.studentNumber).trim();
    localStorage.setItem(recordKey(unitCode, studentNumber), JSON.stringify(record));
    localStorage.setItem(lastStudentKey(unitCode), studentNumber);
    if (studentNumber) {
      const current = listRplStudents(unitCode).filter(item => item.studentNumber !== studentNumber);
      const summary: StudentRecordSummary = {
        name: record.student.name,
        studentNumber,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(studentIndexKey(unitCode), JSON.stringify([summary, ...current].slice(0, 20)));
    }
  } catch {
    // RPL work remains usable even if local storage is unavailable.
  }
}

export function evidenceCode(index: number) {
  return `EV${String(index + 1).padStart(2, '0')}`;
}

export function newEvidenceId() {
  return `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}