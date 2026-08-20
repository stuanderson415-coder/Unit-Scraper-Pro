import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { ClipboardCheck, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  clearRplProgress,
  listRplProgress,
  removeRplProgress,
  RPL_PROGRESS_EVENT,
  type RplProgressItem,
} from '@/lib/rpl-state';

function displayAssessmentDate(entry: RplProgressItem) {
  if (entry.assessmentDate) {
    const [year, month, day] = entry.assessmentDate.split('-').map(Number);
    return format(new Date(year, month - 1, day, 12), 'MMM d, yyyy');
  }
  return format(new Date(entry.updatedAt), 'MMM d, yyyy');
}

export function HistorySidebar({ onSelect }: { onSelect: (code: string, studentNumber: string) => void }) {
  const [progress, setProgress] = useState<RplProgressItem[]>(() => listRplProgress());

  useEffect(() => {
    const refresh = () => setProgress(listRplProgress());
    window.addEventListener(RPL_PROGRESS_EVENT, refresh);
    return () => window.removeEventListener(RPL_PROGRESS_EVENT, refresh);
  }, []);

  const handleClear = () => {
    if (!window.confirm('Clear all RPL assessments in progress? This removes the saved browser records.')) return;
    clearRplProgress();
  };

  const handleDelete = (entry: RplProgressItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Remove the RPL record for ${entry.name || entry.studentNumber}?`)) return;
    removeRplProgress(entry.unitCode, entry.studentNumber);
  };

  return (
    <div className="w-56 flex flex-col h-full overflow-hidden shrink-0 hidden md:flex bg-zinc-700">
      <div className="p-2.5 border-b border-zinc-600 flex items-center justify-between bg-zinc-800">
        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-100">
          <History className="h-3.5 w-3.5 text-white" />
          Applications in progress
        </div>
        {progress.length > 0 && (
          <Button variant="ghost" size="icon" onClick={handleClear} title="Clear history"
            className="h-8 w-8 text-zinc-300 hover:text-red-400 hover:bg-zinc-700">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        {progress.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-200 flex flex-col items-center gap-3 mt-10">
            <div className="w-12 h-12 rounded-full bg-zinc-600 flex items-center justify-center mb-2">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <p>No applications in progress.</p>
            <p className="text-xs text-zinc-300">Start an RPL assessment to see it here.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-600">
            {progress.map(entry => (
              <div
                key={`${entry.unitCode}-${entry.studentNumber}`}
                className="p-3 hover:bg-purple-600/20 cursor-pointer group transition-colors flex gap-3 items-start border-l-2 border-transparent hover:border-purple-500"
                onClick={() => onSelect(entry.unitCode, entry.studentNumber)}
              >
                <div className="mt-0.5">
                  <ClipboardCheck className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-zinc-100 truncate">
                    {entry.name || 'Unnamed student'}
                  </div>
                  <div className="text-xs text-zinc-400 truncate mt-0.5">
                    {entry.unitCode} · {entry.studentNumber}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-1.5 uppercase tracking-wider font-medium">
                    {displayAssessmentDate(entry)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-red-400 hover:bg-zinc-700 shrink-0"
                   onClick={(e) => handleDelete(entry, e)}
                   title="Remove RPL record"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
