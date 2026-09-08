export const EVIDENCE_TYPES = [
  { name: 'Professional Resume', value: 'professional-resume' },
  { name: 'Academic transcript', value: 'academic-transcript' },
  { name: 'Position Description', value: 'position-description' },
  { name: 'Presentation', value: 'presentation' },
  { name: 'Session Plan', value: 'session-plan' },
  { name: 'Demonstration', value: 'demonstration' },
  { name: 'Policy / Procedure', value: 'policy-procedure' },
  { name: "Applicant's Written Work", value: 'applicant-written-work' },
  { name: 'Performance Review', value: 'performance-review' },
  { name: 'Written Reference', value: 'written-reference' },
  { name: 'Risk Assessment', value: 'risk-assessment' },
  { name: 'Image', value: 'image' },
  { name: 'Video', value: 'video' },
  { name: 'Audio', value: 'audio' },
  { name: 'Case Note', value: 'case-note' },
  { name: 'Licence / Permit', value: 'licence-permit' },
  { name: 'Other', value: 'other' },
] as const;

export type EvidenceType = typeof EVIDENCE_TYPES[number]['value'];

export const EVIDENCE_COLOURS = [
  { name: 'Teal', value: 'teal', color: '#0f766e', soft: '#ccfbf1' },
  { name: 'Blue', value: 'blue', color: '#0369a1', soft: '#e0f2fe' },
  { name: 'Indigo', value: 'indigo', color: '#4338ca', soft: '#e0e7ff' },
  { name: 'Purple', value: 'purple', color: '#7e22ce', soft: '#f3e8ff' },
  { name: 'Rose', value: 'rose', color: '#be123c', soft: '#ffe4e6' },
  { name: 'Green', value: 'green', color: '#047857', soft: '#d1fae5' },
  { name: 'Amber', value: 'amber', color: '#b45309', soft: '#fef3c7' },
] as const;

export type EvidenceColour = typeof EVIDENCE_COLOURS[number]['value'];

export const EVIDENCE_LOCATIONS = [
  { name: 'Sighted / Logged', value: 'sighted-logged' },
  { name: 'Hard Copy File', value: 'hard-copy-file' },
  { name: 'Digital / SharePoint', value: 'digital-sharepoint' },
] as const;

export type EvidenceLocation = typeof EVIDENCE_LOCATIONS[number]['value'];

export const EVIDENCE_CLASSIFICATIONS = [
  {
    value: 'direct',
    name: 'Direct',
    description: 'Observed, witnessed, or discussed with the assessor in real time',
    subtypes: [
      { value: 'observation-performance', name: 'Observation of performance' },
      { value: 'demonstration-presentation', name: 'Demonstration or presentation' },
      { value: 'oral-questioning', name: 'Oral questioning or interview' },
      { value: 'role-play-challenge-test', name: 'Role-play or challenge test' },
    ],
  },
  {
    value: 'indirect',
    name: 'Indirect',
    description: 'Student work or submissions reviewed after completion',
    subtypes: [
      { value: 'work-sample-portfolio', name: 'Work sample or portfolio' },
      { value: 'written-assignment-project', name: 'Written assignment or project' },
      { value: 'test-quiz-exam', name: 'Test, quiz, or examination' },
    ],
  },
  {
    value: 'supplementary',
    name: 'Supplementary',
    description: 'Supporting evidence supplied or gathered by another party',
    subtypes: [
      { value: 'supervisor-third-party-report', name: 'Supervisor or third-party report' },
      { value: 'employer-testimonial-reference', name: 'Employer testimonial or reference' },
      { value: 'logbook', name: 'Logbook' },
    ],
  },
] as const;

export type EvidenceClassification = typeof EVIDENCE_CLASSIFICATIONS[number]['value'];
export type EvidenceSubtype = typeof EVIDENCE_CLASSIFICATIONS[number]['subtypes'][number]['value'];

const LEGACY_EVIDENCE_TYPE_BY_COLOUR: Record<string, EvidenceType> = {
  '#0f766e': 'written-reference',
  '#4338ca': 'performance-review',
  '#be123c': 'audio',
  '#b45309': 'risk-assessment',
  '#047857': 'other',
  '#7e22ce': 'video',
};

function migrateEvidenceType(type?: string, color?: string): EvidenceType {
  if (EVIDENCE_TYPES.some(option => option.value === type)) return type as EvidenceType;
  const legacyTypes: Record<string, EvidenceType> = {
    'support-letter': 'written-reference',
    'case-notes': 'case-note',
    'third-party-report': 'performance-review',
    'audio-recording': 'audio',
    reports: 'other',
    'risk-analysis': 'risk-assessment',
    'group-facilitation-plan': 'session-plan',
    'grant-application': 'applicant-written-work',
  };
  return legacyTypes[type ?? ''] ?? LEGACY_EVIDENCE_TYPE_BY_COLOUR[color?.toLowerCase() ?? ''] ?? 'other';
}

export function studentDisplayName(student: Partial<Pick<StudentDetails, 'surname' | 'givenNames'>> & { name?: string }) {
  const formatted = [student.givenNames?.trim(), student.surname?.trim()].filter(Boolean).join(' ');
  return formatted || student.name?.trim() || '';
}

export type InterviewOutcome = 'pending' | 'resolved' | 'not-resolved';

export type PreRplChecklist = {
  interviewCompleted: boolean;
  interviewDate: string;
  interviewNotes: string;
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
    interviewNotes: '',
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
  surname: string;
  givenNames: string;
  studentNumber: string;
  trainerName: string;
  organisation: string;
  assessmentDate: string;
  studentInformed: boolean;
  preRplChecklist: PreRplChecklist;
};

export type EvidenceItem = {
  id: string;
  title: string;
  reference: string;
  notes: string;
  type: EvidenceType;
  colour: EvidenceColour;
  location: EvidenceLocation;
  classifications: EvidenceClassification[];
  subtypes: EvidenceSubtype[];
  sourceKey?: 'pre-rpl-cv' | 'pre-rpl-transcript' | 'pre-rpl-position-description';
};

export type InterviewRecord = {
  question: string;
  studentResponse: string;
  assessorNotes: string;
  outcome: InterviewOutcome;
};

export type RplOutcome = 'granted' | 'in-progress' | 'not-granted';

export type RplFinalisation = {
  outcome: RplOutcome;
  outcomeNotes: string;
  studentSignature: string;
  studentSignatureDate: string;
  assessorSignature: string;
  assessorSignatureDate: string;
};

export function createEmptyRplFinalisation(): RplFinalisation {
  return {
    outcome: 'in-progress',
    outcomeNotes: '',
    studentSignature: '',
    studentSignatureDate: '',
    assessorSignature: '',
    assessorSignatureDate: '',
  };
}

export type RplRecord = {
  student: StudentDetails;
  evidence: EvidenceItem[];
  mappings: Record<string, string[]>;
  interviews: Record<string, InterviewRecord>;
  finalisation: RplFinalisation;
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
      surname: '',
      givenNames: '',
      studentNumber: '',
      trainerName: '',
      organisation: '',
      assessmentDate: '',
      studentInformed: false,
      preRplChecklist: createEmptyPreRplChecklist(),
    },
    evidence: [],
    mappings: {},
    interviews: {},
    finalisation: createEmptyRplFinalisation(),
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
    const parsed = JSON.parse(saved) as Omit<Partial<RplRecord>, 'student' | 'evidence' | 'finalisation'> & {
      student?: Partial<StudentDetails> & { name?: string };
      evidence?: Array<Partial<EvidenceItem> & { color?: string }>;
      finalisation?: Omit<Partial<RplFinalisation>, 'outcome'> & { outcome?: string };
    };
    const legacyName = parsed.student?.name?.trim() ?? '';
    const legacyParts = legacyName.split(/\s+/);
    const legacySurname = legacyParts.length > 1 ? legacyParts.pop() ?? '' : '';
    const legacyGivenNames = legacyParts.join(' ') || legacyName;
    return {
      ...createEmptyRplRecord(),
      ...parsed,
      student: {
        surname: parsed.student?.surname ?? legacySurname,
        givenNames: parsed.student?.givenNames ?? legacyGivenNames,
        studentNumber: parsed.student?.studentNumber ?? '',
        trainerName: parsed.student?.trainerName ?? '',
        organisation: parsed.student?.organisation ?? '',
        assessmentDate: parsed.student?.assessmentDate ?? '',
        studentInformed: parsed.student?.studentInformed ?? false,
        preRplChecklist: {
          ...createEmptyPreRplChecklist(),
          ...parsed.student?.preRplChecklist,
        },
      },
      evidence: (parsed.evidence ?? []).map(item => ({
        id: item.id ?? newEvidenceId(),
        title: item.title ?? '',
        reference: item.reference ?? '',
        notes: item.notes ?? '',
        type: migrateEvidenceType(item.type, item.color),
        colour: item.colour ?? 'teal',
        location: item.location ?? 'sighted-logged',
        classifications: item.classifications ?? [],
        subtypes: item.subtypes ?? [],
        sourceKey: item.sourceKey,
      })),
      mappings: parsed.mappings ?? {},
      interviews: parsed.interviews ?? {},
      finalisation: {
        ...createEmptyRplFinalisation(),
        ...parsed.finalisation,
        outcome: parsed.finalisation?.outcome === 'not-granted'
          ? 'not-granted'
          : parsed.finalisation?.outcome === 'full-rpl'
            ? 'granted'
            : 'in-progress',
      },
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
        surname: record.student.surname,
        givenNames: record.student.givenNames,
        studentNumber,
        trainerName: record.student.trainerName,
        organisation: record.student.organisation,
        assessmentDate: record.student.assessmentDate,
        studentInformed: record.student.studentInformed,
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