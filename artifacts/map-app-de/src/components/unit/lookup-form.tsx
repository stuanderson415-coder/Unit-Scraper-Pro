import { useState } from 'react';
import { CalendarDays, Loader2, UserRound } from 'lucide-react';
import { useLookupUnit, useUploadUnit, type UnitOfCompetency } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { StudentDetails } from '@/lib/rpl-state';

interface Props {
  onUnitLoaded: (unit: UnitOfCompetency, intake: StudentDetails) => void;
  isPending: boolean;
  numTasks: number;
  setNumTasks: (n: number) => void;
  docTitle: string;
  setDocTitle: (s: string) => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function LookupForm({ onUnitLoaded, isPending, numTasks, setNumTasks, docTitle, setDocTitle }: Props) {
  const [code, setCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [intake, setIntake] = useState<StudentDetails>({
    name: '',
    studentNumber: '',
    trainerName: '',
    organisation: '',
    assessmentDate: today(),
  });

  const lookupUnit = useLookupUnit();
  const uploadUnit = useUploadUnit();
  const { toast } = useToast();
  const loading = lookupUnit.isPending || uploadUnit.isPending || isPending;
  const hasRequiredIntake = Boolean(intake.name.trim() && intake.studentNumber.trim());
  const updateIntake = (patch: Partial<StudentDetails>) => setIntake(current => ({ ...current, ...patch }));

  const loadUnit = (unit: UnitOfCompetency) => {
    onUnitLoaded(unit, intake);
    setCode('');
  };

  const handleCodeSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim() || !hasRequiredIntake) return;
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

  const handleFileUpload = () => {
    if (!file || !hasRequiredIntake) return;
    const formData = new FormData();
    formData.append('file', file);
    // @ts-expect-error: generated client accepts FormData at runtime.
    uploadUnit.mutate(formData, {
      onSuccess: unit => {
        loadUnit(unit);
        setFile(null);
      },
      onError: () => toast({
        title: 'Upload failed',
        description: 'Could not parse the PDF.',
        variant: 'destructive',
      }),
    });
  };

  return (
    <Card className="border-teal-900/20 bg-white shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b border-zinc-100 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-teal-800">
            <UserRound className="h-4 w-4" /> RPL intake
          </div>
          <CardTitle className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">Set up an RPL assessment</CardTitle>
          <CardDescription className="mt-1 text-sm">Enter the key people and unit once, then move straight into evidence mapping.</CardDescription>
        </div>
        <div className="hidden rounded-lg bg-teal-50 px-3 py-2 text-right text-xs leading-5 text-teal-900 sm:block">
          <span className="block font-semibold">Recognition of Prior Learning</span>
          <span>Australian VET workflow</span>
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
            <Button type="submit" disabled={!code.trim() || !hasRequiredIntake || loading} className="w-full bg-teal-800 hover:bg-teal-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start RPL
            </Button>
          </div>
        </form>

        <details className="mt-5 border-t border-zinc-100 pt-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-800">Other options: upload a unit PDF or open assessment-mapping settings</summary>
          <div className="mt-3 grid gap-3 rounded-lg bg-zinc-50 p-3 lg:grid-cols-[1fr_auto_auto]">
            <Input type="file" accept=".pdf" onChange={event => setFile(event.target.files?.[0] || null)} disabled={loading} className="h-9 bg-white text-sm" />
            <Button type="button" onClick={handleFileUpload} disabled={!file || !hasRequiredIntake || loading} variant="outline">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Extract unit
            </Button>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span>Assessment tasks</span>
              <Input type="number" min={1} max={12} value={numTasks} onChange={event => setNumTasks(Math.min(12, Math.max(1, Number(event.target.value))))} className="h-9 w-14 bg-white text-center" />
            </div>
            <Input placeholder="Custom title for assessment-mapping export" value={docTitle} onChange={event => setDocTitle(event.target.value)} className="h-9 bg-white text-sm lg:col-span-3" />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}