import { useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useLookupUnit, type UnitOfCompetency } from '@workspace/api-client-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { HistorySidebar } from '@/components/layout/history-sidebar';
import { LookupForm } from '@/components/unit/lookup-form';
import { UnitDisplay } from '@/components/unit/unit-display';

export default function Home() {
  const [currentUnit, setCurrentUnit] = useState<UnitOfCompetency | null>(null);
  
  // Create a separate instance of lookupUnit just for the history sidebar clicks,
  // so we can track its pending state here at the page level.
  const lookupUnit = useLookupUnit();
  const { toast } = useToast();

  const handleHistorySelect = (code: string) => {
    lookupUnit.mutate({ data: { unitCode: code } }, {
      onSuccess: (data) => setCurrentUnit(data),
      onError: () => toast({ title: "Lookup failed", description: "Could not load the selected unit.", variant: "destructive" })
    });
  };

  return (
    <div className="flex h-screen w-full bg-zinc-300 overflow-hidden font-sans">
      <HistorySidebar onSelect={handleHistorySelect} />
      
      <main className="flex-1 flex flex-col h-full relative">
        <ScrollArea className="flex-1 h-full">
          <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-8 pb-24">
            
            <header className="mb-8 hidden md:block space-y-3">
              <div className="flex items-end gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Map App 3.0</h1>
                {/* GPL-3.0 open-source badge */}
                <a
                  href="https://www.gnu.org/licenses/gpl-3.0.en.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-1"
                >
                  <img
                    src="https://img.shields.io/badge/License-GPL%20v3-blue.svg"
                    alt="License: GPL v3"
                    className="h-5"
                  />
                </a>
                {/* GitHub source badge */}
                <a
                  href="https://github.com/stuanderson415-coder/map-app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-1"
                >
                  <img
                    src="https://img.shields.io/badge/Source-GitHub-181717?logo=github"
                    alt="Source on GitHub"
                    className="h-5"
                  />
                </a>
              </div>
              <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
                This app is designed for vocational educators seeking to map their assessment tasks
                to units of competency from nationally accredited training packages. This web
                application is open source. License: GNU GPL&nbsp;v3.{' '}
                <a
                  href="https://github.com/stuanderson415-coder/map-app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                >
                  View source on GitHub
                </a>
                .
              </p>
            </header>

            <LookupForm 
              onUnitLoaded={setCurrentUnit} 
              isPending={lookupUnit.isPending} 
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
                <UnitDisplay unit={currentUnit} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-24 px-4 mt-8 bg-white border border-slate-200 border-dashed rounded-xl shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                  <MapIcon className="w-8 h-8 text-primary/60" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2 tracking-tight">Ready to Map</h3>
                <p className="text-slate-500 max-w-md leading-relaxed text-sm">
                  Enter a unit code or upload a PDF document above to extract and structure its elements and performance criteria instantly.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
