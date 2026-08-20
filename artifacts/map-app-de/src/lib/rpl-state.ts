export const EVIDENCE_COLOURS = [
  { name: 'Teal',    value: '#0f766e', soft: '#ccfbf1' },
  { name: 'Indigo',  value: '#4338ca', soft: '#e0e7ff' },
  { name: 'Rose',    value: '#be123c', soft: '#ffe4e6' },
  { name: 'Amber',   value: '#b45309', soft: '#fef3c7' },
  { name: 'Emerald', value: '#047857', soft: '#d1fae5' },
  { name: 'Violet',  value: '#7e22ce', soft: '#f3e8ff' },
] as const;

export type InterviewOutcome = 'pending' | 'resolved' | 'not-resolved';

export type PreRplChecklist = {
  interviewCompleted: boolean;
  interviewDate: string;
  cvResumeProvided: boolean;
  cvResumeFileName: string;
  academicTranscriptProvided: boolean;
  academicTranscriptFileName: string;
  positionDescriptionProvided: boolean;
  positionDescriptionFileName: string;
  sharePointRepositoryCreated: boolean;
  sharePointPath: string;
};

export function createEmptyPreRplChecklist(): PreRplChecklist {
  return {
    interviewCompleted: false,
    interviewDate: '',
    cvResumeProvided: false,
    cvResumeFileName: '',
    academicTranscriptProvided: false,
    academicTranscriptFileName: '',
    positionDescriptionProvided: false,
    positionDescriptionFileName: '',
    sharePointRepositoryCreated: false,
    sharePointPath: '',
  };
}

export type StudentDetails = {
  name: string;
  studentNumber: string;
  trainerName: string;
  organisation: string;
  assessmentDate: string;
  preRplChecklist: PreRplChecklist;
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

export type RplProgressItem = StudentRecordSummary & {
  unitCode: string;
};

export function createEmptyRplRecord(): RplRecord {
  return {
    student: {
      name: '',
      studentNumber: '',
      trainerName: '',
      organisation: '',
      assessmentDate: '',
      preRplChecklist: createEmptyPreRplChecklist(),
    },
    evidence: [],
    mappings: {},
    interviews: {},
  };
}

const lastStudentKey = (unitCode: string) => `map-app-de:rpl:last-student:${unitCode}`;
const studentIndexKey = (unitCode: string) => `map-app-de:rpl:students:${unitCode}`;
const recordKey = (unitCode: string, studentNumber: string) =>
  `map-app-de:rpl:${unitCode}:${studentNumber.trim() || 'draft'}`;
export const RPL_PROGRESS_EVENT = 'map-app-de:rpl-progress';

function notifyProgressChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(RPL_PROGRESS_EVENT));
  }
}

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
      student: {
        name: parsed.student?.name ?? '',
        studentNumber: parsed.student?.studentNumber ?? '',
        trainerName: parsed.student?.trainerName ?? '',
        organisation: parsed.student?.organisation ?? '',
        assessmentDate: parsed.student?.assessmentDate ?? '',
        preRplChecklist: {
          ...createEmptyPreRplChecklist(),
          ...parsed.student?.preRplChecklist,
        },
      },
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

export function listRplProgress(): RplProgressItem[] {
  try {
    const prefix = 'map-app-de:rpl:students:';
    const progress: RplProgressItem[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const unitCode = key.slice(prefix.length);
      const students = listRplStudents(unitCode);
      for (const student of students) {
        const identity = `${unitCode}:${student.studentNumber}`;
        if (seen.has(identity)) continue;
        seen.add(identity);
        progress.push({ ...student, unitCode });
      }
    }
    return progress.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
}

export function removeRplProgress(unitCode: string, studentNumber: string) {
  try {
    localStorage.removeItem(recordKey(unitCode, studentNumber));
    const remaining = listRplStudents(unitCode).filter(item => item.studentNumber !== studentNumber);
    if (remaining.length) {
      localStorage.setItem(studentIndexKey(unitCode), JSON.stringify(remaining));
      localStorage.setItem(lastStudentKey(unitCode), remaining[0].studentNumber);
    } else {
      localStorage.removeItem(studentIndexKey(unitCode));
      localStorage.removeItem(lastStudentKey(unitCode));
    }
    notifyProgressChanged();
  } catch {
    // RPL work remains usable even if local storage is unavailable.
  }
}

export function clearRplProgress() {
  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('map-app-de:rpl:')) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    notifyProgressChanged();
  } catch {
    // RPL work remains usable even if local storage is unavailable.
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
        trainerName: record.student.trainerName,
        organisation: record.student.organisation,
        assessmentDate: record.student.assessmentDate,
        preRplChecklist: record.student.preRplChecklist,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(studentIndexKey(unitCode), JSON.stringify([summary, ...current].slice(0, 20)));
    }
    notifyProgressChanged();
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