import { useState, useEffect } from 'react';
import { ClipboardCheck, FileCheck2 } from 'lucide-react';
import { useLookupUnit, type UnitOfCompetency } from '@workspace/api-client-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { HistorySidebar } from '@/components/layout/history-sidebar';
import { LookupForm } from '@/components/unit/lookup-form';
import { RplWorkflow } from '@/components/rpl/rpl-workflow';
import { UnitDisplay } from '@/components/unit/unit-display';
import type { StudentDetails } from '@/lib/rpl-state';

const NUM_KEY    = 'map-app-de:numtasks:global';
const TITLE_KEY  = 'map-app-de:doctitle:global';

function loadNum(): number {
  try { const v = localStorage.getItem(NUM_KEY); return v ? Number(v) : 5; } catch { return 5; }
}
function loadTitle(): string {
  try { return localStorage.getItem(TITLE_KEY) ?? ''; } catch { return ''; }
}

function WelcomePanel() {
  const steps = [
    'Confirm the student details and RPL application context.',
    'Build the learner’s certified evidence log.',
    'Map each evidence item to the unit requirements.',
    'Record gaps and complete interview questions or assessments.',
    'Review the coverage and make the final assessment decision.',
    'Generate the completed RPL assessor report.',
  ];

  return (
    <section className="rounded-xl border border-teal-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal-700">Welcome</p>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight text-zinc-900">Welcome to RPL Companion</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-600">
            This tool will assist you to organise and map a student’s evidence submitted toward an RPL application.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-700">Follow these steps</h3>
           <ol className="mt-2 grid gap-1 sm:grid-cols-2">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-2 rounded-lg border border-zinc-100 bg-zinc-50 px-2.5 py-1.5 text-xs leading-4 text-zinc-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[11px] font-bold text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <aside className="rounded-xl border border-teal-100 bg-teal-50/80 p-3">
          <FileCheck2 className="h-5 w-5 text-teal-700" />
          <h3 className="mt-2 text-sm font-semibold text-teal-950">Your final report</h3>
          <p className="mt-1 text-xs leading-5 text-teal-900">
            At the conclusion of the process, you can generate an RPL assessor report combining the learner’s certified evidence log, gap assessments and interview records, final mapping, and assessment decision.
          </p>
          <p className="mt-1 text-[11px] font-medium leading-4 text-teal-800">
            Lodge this report with the student’s RPL application form.
          </p>
        </aside>
      </div>
    </section>
  );
}

export default function Home() {
  const [currentUnit, setCurrentUnit] = useState<UnitOfCompetency | null>(null);
  const [numTasks,    setNumTasksRaw]  = useState<number>(loadNum);
  const [docTitle,    setDocTitleRaw]  = useState<string>(loadTitle);
  const [workspaceMode, setWorkspaceMode] = useState<'rpl' | 'assessment'>('rpl');
  const [selectedRplStudent, setSelectedRplStudent] = useState<string | undefined>();
  const [intakeDetails, setIntakeDetails] = useState<StudentDetails | undefined>();

  const setNumTasks = (n: number) => {
    setNumTasksRaw(n);
    try { localStorage.setItem(NUM_KEY, String(n)); } catch {}
  };
  const setDocTitle = (s: string) => {
    setDocTitleRaw(s);
    try { localStorage.setItem(TITLE_KEY, s); } catch {}
  };

  const lookupUnit = useLookupUnit();
  const { toast } = useToast();

  const handleUnitLoaded = (unit: UnitOfCompetency, intake?: StudentDetails, studentNumber?: string) => {
    setCurrentUnit(unit);
    setWorkspaceMode('rpl');
    setSelectedRplStudent(studentNumber);
    setIntakeDetails(intake);
  };

  const handleHistorySelect = (code: string, studentNumber: string) => {
    lookupUnit.mutate({ data: { unitCode: code } }, {
      onSuccess: data => handleUnitLoaded(data, undefined, studentNumber),
      onError:   () => toast({ title: 'Lookup failed', description: 'Could not load the selected unit.', variant: 'destructive' }),
    });
  };

  const startAnotherRpl = () => {
    setCurrentUnit(null);
    setSelectedRplStudent(undefined);
    setIntakeDetails(undefined);
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-[#26364d] bg-[#122238] text-white shadow-md">
        <div className="flex h-full w-full items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/rpl-companion-logo.png"
              alt="RPL Companion logo"
              className="h-10 w-[66px] shrink-0 object-contain brightness-0 invert"
            />
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">RPL Companion</h1>
              <p className="hidden truncate text-xs text-slate-300 sm:block">Recognition of Prior Learning workspace</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank" rel="noopener noreferrer">
                <img src="https://img.shields.io/badge/License-GPL%20v3-blue.svg" alt="License: GPL v3" className="h-5" />
              </a>
              <a href="https://github.com/stuanderson415-coder/map-app" target="_blank" rel="noopener noreferrer">
                <img src="https://img.shields.io/badge/Source-GitHub-181717?logo=github" alt="Source on GitHub" className="h-5" />
              </a>
            </div>
            {currentUnit && (
              <button type="button" onClick={startAnotherRpl} className="rounded-md border border-slate-400/60 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-slate-100">
                Start another RPL
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mt-16 flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-zinc-300 font-sans">
        <HistorySidebar onSelect={handleHistorySelect} />

        <main className="relative flex h-full min-w-0 flex-1 flex-col">
          <div className="h-full min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-16 md:p-6 md:pb-20">

              {!currentUnit && (
                <>
                  <WelcomePanel />
                  <LookupForm onUnitLoaded={handleUnitLoaded} isPending={lookupUnit.isPending} />
                </>
              )}

              {lookupUnit.isPending ? (
                 <div className="mt-6 space-y-4">
                   <div className="mb-5 flex gap-3">
                    <Skeleton className="h-16 w-48 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                   <Skeleton className="h-[420px] w-full rounded-xl" />
                </div>
              ) : currentUnit ? (
                 <div className="mt-2">
                  {workspaceMode === 'rpl'
                    ? <RplWorkflow key={`${currentUnit.code}:${selectedRplStudent ?? intakeDetails?.studentNumber ?? 'last'}`} unit={currentUnit} studentNumber={selectedRplStudent} prefill={intakeDetails} onOpenAssessmentMapping={() => setWorkspaceMode('assessment')} />
                     : <div className="space-y-4">
                       <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                        <div>
                          <p className="font-mono text-xs font-bold text-zinc-500">{currentUnit.code}</p>
                          <p className="mt-0.5 text-sm font-semibold text-zinc-900">{currentUnit.title}</p>
                        </div>
                        <button type="button" onClick={() => setWorkspaceMode('rpl')} className="rounded-md border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-50">Return to RPL workflow</button>
                      </div>
                      <UnitDisplay unit={currentUnit} numTasks={numTasks} docTitle={docTitle} />
                    </div>}
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
