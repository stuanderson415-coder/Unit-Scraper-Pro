import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History, Trash2, Map as MapIcon, Search, FileText } from 'lucide-react';
import { useGetUnitHistory, getGetUnitHistoryQueryKey, useClearUnitHistory, useDeleteHistoryEntry } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export function HistorySidebar({ onSelect }: { onSelect: (code: string) => void }) {
  const { data: history, isLoading } = useGetUnitHistory();
  const clearHistory = useClearUnitHistory();
  const deleteEntry = useDeleteHistoryEntry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleClear = () => {
    clearHistory.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUnitHistoryQueryKey() });
        toast({ title: "History cleared", description: "All recent lookups have been removed." });
      }
    });
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteEntry.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUnitHistoryQueryKey() });
      }
    });
  };

  return (
    <div className="w-80 border-r bg-white flex flex-col h-full overflow-hidden shrink-0 hidden md:flex">
      <div className="p-4 border-b flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2 font-medium text-slate-700">
          <History className="w-4 h-4" />
          Recent Lookups
        </div>
        {(history?.length ?? 0) > 0 && !isLoading && (
          <Button variant="ghost" size="icon" onClick={handleClear} title="Clear history" className="h-8 w-8 text-slate-500 hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : history?.length === 0 || !history ? (
          <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center gap-3 mt-10">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <MapIcon className="w-6 h-6 text-slate-300" />
            </div>
            <p>No recent lookups.</p>
            <p className="text-xs text-slate-400">Search for a unit code or upload a PDF to see it here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map(entry => (
              <div 
                key={entry.id} 
                className="p-4 hover:bg-slate-50 cursor-pointer group transition-colors flex gap-3 items-start"
                onClick={() => onSelect(entry.unitCode)}
              >
                <div className="mt-0.5">
                  {entry.source === 'pdf' ? (
                    <FileText className="w-4 h-4 text-primary" />
                  ) : (
                    <Search className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-900 truncate">
                    {entry.unitCode}
                  </div>
                  <div className="text-xs text-slate-500 truncate mt-0.5" title={entry.unitTitle}>
                    {entry.unitTitle}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1.5 uppercase tracking-wider font-medium">
                    {format(new Date(entry.lookedUpAt), 'MMM d, h:mm a')}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={(e) => handleDelete(entry.id, e)}
                  title="Remove from history"
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
