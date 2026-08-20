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

  const handleUnitLoaded = (unit: UnitOfCompetency) => {
    setCurrentUnit(unit);
    setWorkspaceMode('rpl');
  };

  const handleHistorySelect = (code: string) => {
    lookupUnit.mutate({ data: { unitCode: code } }, {
      onSuccess: handleUnitLoaded,
      onError:   () => toast({ title: 'Lookup failed', description: 'Could not load the selected unit.', variant: 'destructive' }),
    });
  };

  return (
    <div className="flex h-screen w-full bg-zinc-300 overflow-hidden font-sans">
      <HistorySidebar onSelect={handleHistorySelect} />

      <main className="flex-1 flex flex-col h-full relative">
        <ScrollArea className="flex-1 h-full">
          <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8 pb-24">

            <header className="mb-8 hidden md:block space-y-3">
              <div className="flex items-end gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Map App 3.0</h1>
                <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank" rel="noopener noreferrer" className="mb-1">
                  <img src="https://img.shields.io/badge/License-GPL%20v3-blue.svg" alt="License: GPL v3" className="h-5" />
                </a>
                <a href="https://github.com/stuanderson415-coder/map-app" target="_blank" rel="noopener noreferrer" className="mb-1">
                  <img src="https://img.shields.io/badge/Source-GitHub-181717?logo=github" alt="Source on GitHub" className="h-5" />
                </a>
              </div>
              <p className="text-sm text-zinc-600 max-w-2xl leading-relaxed">
                This app is designed for vocational educators seeking to map their assessment tasks
                to units of competency from nationally accredited training packages. This web
                application is open source. License: GNU GPL&nbsp;v3.{' '}
                <a href="https://github.com/stuanderson415-coder/map-app" target="_blank" rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-zinc-900">
                  View source on GitHub
                </a>.
              </p>
            </header>

            <LookupForm
              onUnitLoaded={handleUnitLoaded}
              isPending={lookupUnit.isPending}
              numTasks={numTasks}
              setNumTasks={setNumTasks}
              docTitle={docTitle}
              setDocTitle={setDocTitle}
            />

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
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm">
                  <div className="px-2 text-xs font-medium text-zinc-500">Choose a workspace for this unit</div>
                  <div className="flex rounded-lg bg-zinc-100 p-1">
                    <button type="button" onClick={() => setWorkspaceMode('rpl')} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${workspaceMode === 'rpl' ? 'bg-teal-800 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>RPL workflow</button>
                    <button type="button" onClick={() => setWorkspaceMode('assessment')} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${workspaceMode === 'assessment' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}>Assessment mapping</button>
                  </div>
                </div>
                {workspaceMode === 'rpl'
                  ? <RplWorkflow key={currentUnit.code} unit={currentUnit} />
                  : <UnitDisplay unit={currentUnit} numTasks={numTasks} docTitle={docTitle} />}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-24 px-4 mt-8 bg-white border border-zinc-300 border-dashed rounded-xl shadow-sm">
                <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-zinc-200">
                  <MapIcon className="w-8 h-8 text-zinc-400" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-800 mb-2 tracking-tight">Ready to Map</h3>
                <p className="text-zinc-500 max-w-md leading-relaxed text-sm">
                  Enter a unit code above to fetch from training.gov.au, or upload a PDF document.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
