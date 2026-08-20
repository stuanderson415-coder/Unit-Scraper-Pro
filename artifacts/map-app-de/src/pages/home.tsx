import { useState, useEffect } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useLookupUnit, type UnitOfCompetency } from '@workspace/api-client-react';
import { ScrollArea } from '@/components/ui/scroll-area';
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
      <header className="fixed inset-x-0 top-0 z-50 h-[4.5rem] border-b border-[#26364d] bg-[#122238] text-white shadow-md">
        <div className="flex h-full w-full items-center justify-between gap-4 px-5 md:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/rpl-companion-logo.png"
              alt="RPL Companion logo"
              className="h-12 w-[78px] shrink-0 object-contain brightness-0 invert"
            />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">RPL Companion</h1>
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

      <div className="mt-[4.5rem] flex h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-zinc-300 font-sans">
        <HistorySidebar onSelect={handleHistorySelect} />

        <main className="flex-1 flex flex-col h-full relative">
          <ScrollArea className="flex-1 h-full">
            <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8 pb-24">

              {!currentUnit && (
                <LookupForm
                  onUnitLoaded={handleUnitLoaded}
                  isPending={lookupUnit.isPending}
                />
              )}

              {lookupUnit.isPending ? (
                <div className="space-y-6 mt-10">
                  <div className="flex gap-4 mb-8">
                    <Skeleton className="h-16 w-48 rounded-lg" />
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-[500px] w-full rounded-xl" />
                </div>
              ) : currentUnit ? (
                <div className="mt-10">
                  {workspaceMode === 'rpl'
                    ? <RplWorkflow key={`${currentUnit.code}:${selectedRplStudent ?? intakeDetails?.studentNumber ?? 'last'}`} unit={currentUnit} studentNumber={selectedRplStudent} prefill={intakeDetails} onOpenAssessmentMapping={() => setWorkspaceMode('assessment')} />
                    : <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                        <div>
                          <p className="font-mono text-xs font-bold text-zinc-500">{currentUnit.code}</p>
                          <p className="mt-0.5 text-sm font-semibold text-zinc-900">{currentUnit.title}</p>
                        </div>
                        <button type="button" onClick={() => setWorkspaceMode('rpl')} className="rounded-md border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-50">Return to RPL workflow</button>
                      </div>
                      <UnitDisplay unit={currentUnit} numTasks={numTasks} docTitle={docTitle} />
                    </div>}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-24 px-4 mt-8 bg-white border border-zinc-300 border-dashed rounded-xl shadow-sm">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-zinc-200">
                    <MapIcon className="w-8 h-8 text-zinc-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-800 mb-2 tracking-tight">Start an RPL assessment</h3>
                  <p className="text-zinc-500 max-w-md leading-relaxed text-sm">
                    Enter a unit code above to fetch the unit from training.gov.au and begin the RPL assessment.
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </>
  );
}
