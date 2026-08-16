import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useLookupUnit, useUploadUnit, getGetUnitHistoryQueryKey, type UnitOfCompetency } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export function LookupForm({ onUnitLoaded, isPending }: { onUnitLoaded: (unit: UnitOfCompetency) => void, isPending: boolean }) {
  const [code, setCode] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const lookupUnit = useLookupUnit();
  const uploadUnit = useUploadUnit();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    lookupUnit.mutate({ data: { unitCode: code.trim() } }, {
      onSuccess: (data) => {
        onUnitLoaded(data);
        queryClient.invalidateQueries({ queryKey: getGetUnitHistoryQueryKey() });
        setCode('');
      },
      onError: () => {
        toast({ title: "Lookup failed", description: "Could not find unit or training.gov.au is unavailable.", variant: "destructive" });
      }
    });
  };

  const handleFileUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    // @ts-expect-error: instructed to pass FormData directly
    uploadUnit.mutate(formData, {
      onSuccess: (data) => {
        onUnitLoaded(data);
        queryClient.invalidateQueries({ queryKey: getGetUnitHistoryQueryKey() });
        setFile(null);
      },
      onError: () => {
        toast({ title: "Upload failed", description: "Could not parse the PDF.", variant: "destructive" });
      }
    });
  };

  const loading = lookupUnit.isPending || uploadUnit.isPending || isPending;

  return (
    <Card className="border-zinc-400 shadow-md bg-zinc-300">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl text-zinc-900 font-semibold tracking-tight">Map a Unit of Competency</CardTitle>
        <CardDescription className="text-zinc-600">Enter a unit code to pull from training.gov.au or upload a PDF document.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="code" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-zinc-400/60 p-1">
            <TabsTrigger value="code" className="data-[state=active]:bg-zinc-100 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 data-[state=active]:font-semibold">Code Lookup</TabsTrigger>
            <TabsTrigger value="pdf" className="data-[state=active]:bg-zinc-100 data-[state=active]:shadow-sm data-[state=active]:text-purple-700 data-[state=active]:font-semibold">PDF Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <form onSubmit={handleCodeSubmit} className="flex gap-3">
              <Input
                placeholder="e.g. BSBMGT517"
                value={code}
                onChange={e => setCode(e.target.value)}
                className="flex-1 font-mono text-sm uppercase bg-zinc-100 border-zinc-400 focus-visible:ring-purple-400/40 focus-visible:border-purple-500"
                disabled={loading}
              />
              <Button type="submit" disabled={!code.trim() || loading}
                className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px] shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lookup Unit"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="pdf" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <form onSubmit={handleFileUpload} className="flex gap-3 items-center">
              <div className="flex-1 relative">
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                  className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-500 file:text-white hover:file:bg-zinc-600 cursor-pointer h-10 bg-zinc-100 border-zinc-400 text-sm text-zinc-700 focus-visible:ring-purple-400/40"
                  disabled={loading}
                />
              </div>
              <Button type="submit" disabled={!file || loading}
                className="bg-purple-600 hover:bg-purple-700 text-white min-w-[120px] shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Extract Elements"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
