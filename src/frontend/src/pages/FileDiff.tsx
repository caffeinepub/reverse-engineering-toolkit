import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { GitCompare, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DiffResult {
  sizeA: number;
  sizeB: number;
  diffCount: number;
  similarity: number;
  diffPositions: { offset: number; byteA: string; byteB: string }[];
}

function diffBytes(a: Uint8Array, b: Uint8Array): DiffResult {
  const minLen = Math.min(a.length, b.length);
  let diffCount = Math.abs(a.length - b.length); // bytes present in one but not other
  const positions: { offset: number; byteA: string; byteB: string }[] = [];

  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) {
      diffCount++;
      if (positions.length < 32) {
        positions.push({
          offset: i,
          byteA: a[i].toString(16).padStart(2, "0").toUpperCase(),
          byteB: b[i].toString(16).padStart(2, "0").toUpperCase(),
        });
      }
    }
  }

  const maxLen = Math.max(a.length, b.length);
  const similarity =
    maxLen === 0 ? 100 : Math.round(((maxLen - diffCount) / maxLen) * 100);

  return {
    sizeA: a.length,
    sizeB: b.length,
    diffCount,
    similarity,
    diffPositions: positions,
  };
}

interface FileDropZoneProps {
  label: string;
  filename: string;
  onFile: (file: File) => void;
  ocid: string;
}

function FileDropZone({ label, filename, onFile, ocid }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  return (
    <label
      data-ocid={ocid}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "border-2 border-dashed rounded p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 min-h-36",
        isDragging
          ? "border-terminal-green bg-terminal-green/5 glow-green"
          : "border-border hover:border-terminal-green/50 hover:bg-muted/20",
      )}
    >
      <input
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <Upload className="w-6 h-6 text-muted-foreground mb-2" />
      <p className="font-mono text-sm font-semibold text-terminal-cyan mb-1">
        {label}
      </p>
      <p className="font-mono text-xs text-foreground">
        {filename || "Drop file or click to upload"}
      </p>
    </label>
  );
}

export function FileDiff() {
  const [fileA, setFileA] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);
  const [fileB, setFileB] = useState<{
    name: string;
    bytes: Uint8Array;
  } | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const createSession = useCreateSession();

  // Auto-compare when both files loaded
  const handleFileA = async (file: File) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    setFileA({ name: file.name, bytes });
    setDiffResult(null);
    toast.success(`Loaded File A: ${file.name}`);
    if (fileB) {
      setIsComputing(true);
      try {
        const result = diffBytes(bytes, fileB.bytes);
        setDiffResult(result);
        await createSession.mutateAsync({
          filename: `${file.name} vs ${fileB.name}`,
          tool: "File Diff",
          resultSummary: `${result.diffCount} differences (${result.similarity}% similar)`,
        });
        toast.success(`Comparison complete — ${result.similarity}% similar`);
      } catch {
        /* non-critical */
      } finally {
        setIsComputing(false);
      }
    }
  };

  const handleFileB = async (file: File) => {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    setFileB({ name: file.name, bytes });
    setDiffResult(null);
    toast.success(`Loaded File B: ${file.name}`);
    if (fileA) {
      setIsComputing(true);
      try {
        const result = diffBytes(fileA.bytes, bytes);
        setDiffResult(result);
        await createSession.mutateAsync({
          filename: `${fileA.name} vs ${file.name}`,
          tool: "File Diff",
          resultSummary: `${result.diffCount} differences (${result.similarity}% similar)`,
        });
        toast.success(`Comparison complete — ${result.similarity}% similar`);
      } catch {
        /* non-critical */
      } finally {
        setIsComputing(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ file-diff
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Compare two files byte-by-byte and visualize differences
        </p>
      </div>

      {/* Drop zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FileDropZone
          label="File A"
          filename={fileA?.name ?? ""}
          onFile={handleFileA}
          ocid="filediff.file_a.upload_button"
        />
        <FileDropZone
          label="File B"
          filename={fileB?.name ?? ""}
          onFile={handleFileB}
          ocid="filediff.file_b.upload_button"
        />
      </div>

      {isComputing && (
        <div
          data-ocid="filediff.loading_state"
          className="flex items-center gap-3 p-4 rounded border border-terminal-green/30 bg-terminal-green/5"
        >
          <div className="w-4 h-4 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-terminal-green">
            Comparing files...
          </span>
        </div>
      )}

      {diffResult && !isComputing && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "File A Size",
                value: `${diffResult.sizeA.toLocaleString()} B`,
                color: "text-terminal-cyan",
              },
              {
                label: "File B Size",
                value: `${diffResult.sizeB.toLocaleString()} B`,
                color: "text-terminal-amber",
              },
              {
                label: "Different Bytes",
                value: diffResult.diffCount.toLocaleString(),
                color:
                  diffResult.diffCount === 0
                    ? "text-terminal-green"
                    : "text-destructive",
              },
              {
                label: "Similarity",
                value: `${diffResult.similarity}%`,
                color:
                  diffResult.similarity > 80
                    ? "text-terminal-green"
                    : diffResult.similarity > 50
                      ? "text-terminal-amber"
                      : "text-destructive",
              },
            ].map((s) => (
              <Card
                key={s.label}
                data-ocid="filediff.stats.card"
                className="border-border bg-card/60"
              >
                <CardContent className="p-4">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
                    {s.label}
                  </p>
                  <p className={`font-mono text-xl font-bold ${s.color}`}>
                    {s.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Similarity bar */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
                <GitCompare className="w-4 h-4" />
                Similarity Meter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground">
                  0% (totally different)
                </span>
                <span
                  className={
                    diffResult.similarity > 80
                      ? "text-terminal-green font-bold"
                      : diffResult.similarity > 50
                        ? "text-terminal-amber font-bold"
                        : "text-destructive font-bold"
                  }
                >
                  {diffResult.similarity}% similar
                </span>
                <span className="text-muted-foreground">100% (identical)</span>
              </div>
              <Progress
                data-ocid="filediff.similarity.chart_point"
                value={diffResult.similarity}
                className="h-3"
              />
              {diffResult.diffCount === 0 && (
                <Badge
                  variant="outline"
                  className="font-mono text-xs text-terminal-green border-terminal-green/30 bg-terminal-green/5"
                >
                  ✓ Files are identical
                </Badge>
              )}
            </CardContent>
          </Card>

          {/* Diff table */}
          {diffResult.diffPositions.length > 0 && (
            <Card className="border-border bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-mono text-sm text-terminal-cyan">
                    Differing Byte Positions
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="font-mono text-xs text-muted-foreground border-border"
                  >
                    First {diffResult.diffPositions.length} of{" "}
                    {diffResult.diffCount.toLocaleString()} diffs
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded border border-border overflow-hidden max-h-80 overflow-y-auto">
                  <Table data-ocid="filediff.diff.table">
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                          Offset
                        </TableHead>
                        <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                          Offset (hex)
                        </TableHead>
                        <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                          Byte A
                        </TableHead>
                        <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                          Byte B
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diffResult.diffPositions.map((d, i) => (
                        <TableRow
                          key={`${d.offset}-${i}`}
                          data-ocid={`filediff.diff.row.${i + 1}`}
                          className="border-border hover:bg-muted/20 font-mono text-xs"
                        >
                          <TableCell className="text-muted-foreground">
                            {d.offset.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-terminal-amber">
                            0x
                            {d.offset
                              .toString(16)
                              .padStart(8, "0")
                              .toUpperCase()}
                          </TableCell>
                          <TableCell className="text-terminal-cyan">
                            {d.byteA}
                          </TableCell>
                          <TableCell className="text-destructive">
                            {d.byteB}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!fileA && !fileB && !diffResult && (
        <div
          data-ocid="filediff.results.empty_state"
          className="flex flex-col items-center justify-center py-10 gap-3 text-center"
        >
          <div className="w-12 h-12 rounded border border-border flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-muted-foreground/40" />
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Drop File A and File B above to compare
          </p>
        </div>
      )}
    </div>
  );
}
