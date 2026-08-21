import { useState } from 'react';
import { CalendarDays, FileText, Loader2, UserRound } from 'lucide-react';
import { useLookupUnit, type UnitOfCompetency } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createEmptyPreRplChecklist, type StudentDetails } from '@/lib/rpl-state';

interface Props {
  onUnitLoaded: (unit: UnitOfCompetency, intake: StudentDetails) => void;
  isPending: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

type ChecklistDocumentProps = {
  id: string;
  label: string;
  checked: boolean;
  fileName: string;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  onFileChange: (file: File | null) => void;
};

function ChecklistDocument({ id, label, checked, fileName, disabled, onCheckedChange, onFileChange }: ChecklistDocumentProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2.5">
      <div className="flex items-start gap-2">
        <Checkbox id={id} checked={checked} onCheckedChange={value => onCheckedChange(value === true)} disabled={disabled} />
        <label htmlFor={id} className="cursor-pointer text-xs font-semibold leading-4 text-zinc-800">{label}</label>
      </div>
      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1.5 text-[11px] font-medium text-zinc-600 transition hover:border-teal-600 hover:text-teal-800">
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{fileName || 'Choose document'}</span>
        <Input
          type="file"
          accept=".pdf,.doc,.docx"
          className="sr-only"
          onChange={event => onFileChange(event.target.files?.[0] ?? null)}
          disabled={disabled}
        />
      </label>
    </div>
  );
}

export function LookupForm({ onUnitLoaded, isPending }: Props) {
  const [code, setCode] = useState('');
  const [intake, setIntake] = useState<StudentDetails>({
    name: '',
    studentNumber: '',
    trainerName: '',
    organisation: '',
    assessmentDate: today(),
    preRplChecklist: createEmptyPreRplChecklist(),
  });

  const lookupUnit = useLookupUnit();
  const { toast } = useToast();
  const loading = lookupUnit.isPending || isPending;
  const hasRequiredIntake = Boolean(intake.name.trim() && intake.studentNumber.trim());
  const updateIntake = (patch: Partial<StudentDetails>) => setIntake(current => ({ ...current, ...patch }));
  const updateChecklist = (patch: Partial<StudentDetails['preRplChecklist']>) => setIntake(current => ({
    ...current,
    preRplChecklist: { ...current.preRplChecklist, ...patch },
  }));

  const loadUnit = (unit: UnitOfCompetency) => {
    onUnitLoaded(unit, intake);
    setCode('');
  };

  const handleCodeSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!intake.name.trim() || !intake.studentNumber.trim() || !code.trim()) {
      toast({
        title: 'Complete the required fields',
        description: 'Enter the student name, student number, and unit code before selecting Start.',
        variant: 'destructive',
      });
      return;
    }
    lookupUnit.mutate(
      { data: { unitCode: code.trim() } },
      {
        onSuccess: loadUnit,
        onError: () => toast({
          title: 'Lookup failed',
          description: 'Could not find the unit or training.gov.au is unavailable.',
          variant: 'destructive',
        }),
      },
    );
  };

  return (
    <Card className="border-teal-300/60 bg-white shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b border-zinc-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
            <UserRound className="h-4 w-4" /> RPL intake
          </div>
          <CardTitle className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">Start an RPL assessment</CardTitle>
          <CardDescription className="mt-1 text-sm">Enter the key people and unit once, then follow the guided RPL workflow.</CardDescription>
        </div>
        <div className="hidden rounded-lg bg-teal-50 px-3 py-2 text-right text-xs leading-5 text-teal-900 sm:block">
          <span className="block font-semibold">Recognition of Prior Learning</span>
          <span>Evidence Mapping Tool</span>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <form onSubmit={handleCodeSubmit} className="grid gap-4 lg:grid-cols-6">
          <label className="grid gap-1.5 lg:col-span-2">
            <span className="text-xs font-semibold text-zinc-700">Student name <span className="text-rose-600">*</span></span>
            <Input placeholder="e.g. Alex Morgan" value={intake.name} onChange={event => updateIntake({ name: event.target.value })} disabled={loading} />
          </label>
          <label className="grid gap-1.5 lg:col-span-1">
            <span className="text-xs font-semibold text-zinc-700">Student number <span className="text-rose-600">*</span></span>
            <Input placeholder="e.g. 12345678" value={intake.studentNumber} onChange={event => updateIntake({ studentNumber: event.target.value })} disabled={loading} />
          </label>
          <label className="grid gap-1.5 lg:col-span-2">
            <span className="text-xs font-semibold text-zinc-700">Trainer / assessor</span>
            <Input placeholder="e.g. Jordan Lee" value={intake.trainerName} onChange={event => updateIntake({ trainerName: event.target.value })} disabled={loading} />
          </label>
          <label className="grid gap-1.5 lg:col-span-1">
            <span className="text-xs font-semibold text-zinc-700">Assessment date</span>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input type="date" value={intake.assessmentDate} onChange={event => updateIntake({ assessmentDate: event.target.value })} className="pl-9" disabled={loading} />
            </div>
          </label>
          <label className="grid gap-1.5 lg:col-span-3">
            <span className="text-xs font-semibold text-zinc-700">Organisation / RTO</span>
            <Input placeholder="e.g. Your RTO or workplace" value={intake.organisation} onChange={event => updateIntake({ organisation: event.target.value })} disabled={loading} />
          </label>
          <label className="grid gap-1.5 lg:col-span-2">
            <span className="text-xs font-semibold text-zinc-700">Unit seeking RPL for <span className="text-rose-600">*</span></span>
            <Input placeholder="e.g. CHCCCS007" value={code} onChange={event => setCode(event.target.value.toUpperCase())} className="font-mono" disabled={loading} />
          </label>
          <div className="flex items-end lg:col-span-1">
            <Button type="submit" disabled={loading} className="h-9 w-full px-2 text-xs bg-teal-600 hover:bg-teal-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start
            </Button>
          </div>
        </form>

        <details className="mt-4 border-t border-zinc-100 pt-2">
          <summary className="cursor-pointer text-[11px] font-medium text-zinc-500 hover:text-zinc-800">Pre-RPL Interview</summary>
          <div className="mt-2 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-teal-800">RPL Pre-Assessment</h3>
            <section className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pre-rpl-interview"
                  checked={intake.preRplChecklist.interviewCompleted}
                  onCheckedChange={value => updateChecklist({ interviewCompleted: value === true })}
                  disabled={loading}
                />
                <label htmlFor="pre-rpl-interview" className="cursor-pointer text-[11px] font-semibold text-zinc-800">Pre-RPL interview completed</label>
              </div>
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold text-zinc-700">Interview date</span>
                <Input
                  type="date"
                  value={intake.preRplChecklist.interviewDate}
                  onChange={event => updateChecklist({ interviewDate: event.target.value })}
                  disabled={loading}
                  className="h-8 bg-white text-xs"
                />
              </label>
            </section>

            <section className="border-t border-zinc-200 pt-3">
              <div className="mb-2">
                <h3 className="text-xs font-semibold text-zinc-900">Base documents provided</h3>
                <p className="mt-0.5 text-[11px] text-zinc-500">Tick each item received and choose its supporting document.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ChecklistDocument
                  id="cv-resume"
                  label="CV / résumé"
                  checked={intake.preRplChecklist.cvResumeProvided}
                  fileName={intake.preRplChecklist.cvResumeFileName}
                  disabled={loading}
                  onCheckedChange={checked => updateChecklist({ cvResumeProvided: checked })}
                  onFileChange={file => updateChecklist({ cvResumeProvided: Boolean(file), cvResumeFileName: file?.name ?? '' })}
                />
                <ChecklistDocument
                  id="academic-transcript"
                  label="Academic transcript"
                  checked={intake.preRplChecklist.academicTranscriptProvided}
                  fileName={intake.preRplChecklist.academicTranscriptFileName}
                  disabled={loading}
                  onCheckedChange={checked => updateChecklist({ academicTranscriptProvided: checked })}
                  onFileChange={file => updateChecklist({ academicTranscriptProvided: Boolean(file), academicTranscriptFileName: file?.name ?? '' })}
                />
                <ChecklistDocument
                  id="position-description"
                  label="Current position description"
                  checked={intake.preRplChecklist.positionDescriptionProvided}
                  fileName={intake.preRplChecklist.positionDescriptionFileName}
                  disabled={loading}
                  onCheckedChange={checked => updateChecklist({ positionDescriptionProvided: checked })}
                  onFileChange={file => updateChecklist({ positionDescriptionProvided: Boolean(file), positionDescriptionFileName: file?.name ?? '' })}
                />
              </div>
            </section>

            <section className="grid gap-3 border-t border-zinc-200 pt-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-end">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sharepoint-repository"
                  checked={intake.preRplChecklist.sharePointRepositoryCreated}
                  onCheckedChange={value => updateChecklist({ sharePointRepositoryCreated: value === true })}
                  disabled={loading}
                />
                <label htmlFor="sharepoint-repository" className="cursor-pointer text-xs font-semibold text-zinc-800">SharePoint evidence repository created</label>
              </div>
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold text-zinc-700">SharePoint path</span>
                <Input
                  placeholder="https://… or document library / folder path"
                  value={intake.preRplChecklist.sharePointPath}
                  onChange={event => updateChecklist({ sharePointPath: event.target.value })}
                  disabled={loading}
                  className="h-8 bg-white text-xs"
                />
              </label>
            </section>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}