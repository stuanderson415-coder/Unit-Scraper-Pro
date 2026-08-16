import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useLookupUnit, useUploadUnit, getGetUnitHistoryQueryKey, type UnitOfCompetency } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onUnitLoaded: (unit: UnitOfCompetency) => void;
  isPending: boolean;
  numTasks: number;
  setNumTasks: (n: number) => void;
  docTitle: string;
  setDocTitle: (s: string) => void;
}

export function LookupForm({ onUnitLoaded, isPending, numTasks, setNumTasks, docTitle, setDocTitle }: Props) {
  const [code, setCode] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const lookupUnit  = useLookupUnit();
  const uploadUnit  = useUploadUnit();
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const loading = lookupUnit.isPending || uploadUnit.isPending || isPending;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getGetUnitHistoryQueryKey() });

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    lookupUnit.mutate({ data: { unitCode: code.trim() } }, {
      onSuccess: (data) => { onUnitLoaded(data); invalidate(); setCode(''); },
      onError:   () => toast({ title: 'Lookup failed', description: 'Could not find unit or training.gov.au is unavailable.', variant: 'destructive' }),
    });
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    // @ts-expect-error: pass FormData directly
    uploadUnit.mutate(fd, {
      onSuccess: (data) => { onUnitLoaded(data); invalidate(); setFile(null); },
      onError:   () => toast({ title: 'Upload failed', description: 'Could not parse the PDF.', variant: 'destructive' }),
    });
  };

  return (
    <Card className="border-zinc-300 shadow-sm bg-zinc-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-zinc-900 font-semibold tracking-tight">Map a Unit of Competency</CardTitle>
        <CardDescription className="text-zinc-500 text-sm">Fetch from training.gov.au or upload a PDF.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">

        {/* ── Row 1: Code · Assessments · Lookup ── */}
        <form onSubmit={handleCodeSubmit} className="flex items-center gap-2">
          {/* Unit code — intentionally short */}
          <Input
            placeholder="Unit code"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            className="w-36 font-mono text-sm bg-white border-zinc-300 focus-visible:ring-zinc-400/40 focus-visible:border-zinc-500 placeholder:text-zinc-400"
            disabled={loading}
          />

          {/* Number of assessments */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="text-xs text-zinc-500 whitespace-nowrap">Assessments</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={numTasks}
              onChange={e => setNumTasks(Math.min(12, Math.max(1, Number(e.target.value))))}
              className="w-16 text-sm text-center bg-white border-zinc-300 focus-visible:ring-zinc-400/40"
              disabled={loading}
            />
          </div>

          <Button
            type="submit"
            disabled={!code.trim() || loading}
            className="bg-zinc-900 hover:bg-zinc-700 text-white shrink-0 shadow-sm"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Lookup Unit
          </Button>
        </form>

        {/* ── Row 2: Custom document title ── */}
        <Input
          placeholder="Document title / custom label (used in Word export)"
          value={docTitle}
          onChange={e => setDocTitle(e.target.value)}
          className="w-full text-sm bg-white border-zinc-300 focus-visible:ring-zinc-400/40 placeholder:text-zinc-400"
        />

        {/* ── Row 3: PDF upload (secondary) ── */}
        <form onSubmit={handleFileUpload} className="flex items-center gap-2 pt-1 border-t border-zinc-200">
          <span className="text-xs text-zinc-400 shrink-0">or PDF:</span>
          <Input
            type="file"
            accept=".pdf"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="flex-1 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-medium file:bg-zinc-200 file:text-zinc-700 hover:file:bg-zinc-300 cursor-pointer h-9 bg-white border-zinc-300 text-sm text-zinc-600 focus-visible:ring-zinc-400/40"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={!file || loading}
            className="bg-zinc-900 hover:bg-zinc-700 text-white shrink-0 shadow-sm"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Extract
          </Button>
        </form>

      </CardContent>
    </Card>
  );
}
