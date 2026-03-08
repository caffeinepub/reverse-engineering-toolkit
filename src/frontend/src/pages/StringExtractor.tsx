import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Check, Copy, Download, Search, Type, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface StringResult {
  offset: string;
  value: string;
}

function extractStrings(bytes: Uint8Array, minLen: number): StringResult[] {
  const results: StringResult[] = [];
  let current = "";
  let start = 0;
  for (let i = 0; i <= bytes.length; i++) {
    const b = i < bytes.length ? bytes[i] : 0;
    const isPrintable = b >= 0x20 && b < 0x7f;
    if (isPrintable) {
      if (current.length === 0) start = i;
      current += String.fromCharCode(b);
    } else {
      if (current.length >= minLen) {
        results.push({
          offset: `0x${start.toString(16).padStart(8, "0")}`,
          value: current,
        });
      }
      current = "";
    }
  }
  return results;
}

function extractFromText(text: string, minLen: number): StringResult[] {
  const lines = text.split(/\n/);
  const results: StringResult[] = [];
  let offset = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length >= minLen) {
      results.push({
        offset: `0x${offset.toString(16).padStart(8, "0")}`,
        value: trimmed,
      });
    }
    offset += line.length + 1;
  }
  return results;
}

export function StringExtractor() {
  const [results, setResults] = useState<StringResult[]>([]);
  const [minLength, setMinLength] = useState(4);
  const [rawText, setRawText] = useState("");
  const [filename, setFilename] = useState("");
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createSession = useCreateSession();

  const handleFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    setFileBytes(new Uint8Array(buffer));
    setFilename(file.name);
    setRawText("");
    toast.success(`Loaded: ${file.name}`);
  };

  const handleExtract = async () => {
    setIsProcessing(true);
    try {
      let extracted: StringResult[];
      if (fileBytes) {
        extracted = extractStrings(fileBytes, minLength);
      } else if (rawText.trim()) {
        extracted = extractFromText(rawText, minLength);
      } else {
        toast.error("Upload a file or paste text first");
        return;
      }
      setResults(extracted);

      const name = filename || "pasted-text";
      const summary = `${extracted.length} strings found (min length: ${minLength})`;
      await createSession.mutateAsync({
        filename: name,
        tool: "String Extractor",
        resultSummary: summary,
      });
      toast.success(`Found ${extracted.length} strings`);
    } catch {
      toast.error("Extraction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyAll = async () => {
    const text = results.map((r) => `${r.offset}\t${r.value}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const handleExport = (format: "json" | "csv") => {
    if (format === "json") {
      const data = { filename: filename || "pasted-text", strings: results };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename || "strings"}.strings.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const rows = ["Offset,String"];
      for (const r of results) {
        rows.push(`${r.offset},"${r.value.replace(/"/g, '""')}"`);
      }
      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename || "strings"}.strings.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ string-extractor
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Extract printable ASCII strings from binary files or raw text
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upload */}
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              data-ocid="strings.upload_button"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={cn(
                "border-2 border-dashed rounded p-6 flex flex-col items-center cursor-pointer transition-all",
                isDragging
                  ? "border-terminal-green bg-terminal-green/5"
                  : "border-border hover:border-terminal-green/40",
              )}
            >
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Upload className="w-5 h-5 text-muted-foreground mb-2" />
              <p className="font-mono text-xs text-foreground">
                {filename ? filename : "Drop file or click to upload"}
              </p>
            </label>

            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span className="font-mono text-xs">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs text-muted-foreground">
                Paste raw text
              </Label>
              <Textarea
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setFileBytes(null);
                  setFilename("");
                }}
                placeholder="Paste binary content or text here..."
                className="font-mono text-xs bg-terminal-bg border-border resize-none h-28 text-terminal-green placeholder:text-muted-foreground/40"
              />
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
              <Search className="w-4 h-4" />
              Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label
                  data-ocid="strings.min_length.input"
                  className="font-mono text-xs text-muted-foreground"
                >
                  Minimum String Length
                </Label>
                <Badge
                  variant="outline"
                  className="font-mono text-xs text-terminal-green border-terminal-green/30"
                >
                  {minLength} chars
                </Badge>
              </div>
              <Slider
                value={[minLength]}
                onValueChange={([v]) => setMinLength(v)}
                min={2}
                max={32}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between font-mono text-xs text-muted-foreground/50">
                <span>2</span>
                <span>32</span>
              </div>
            </div>

            <Button
              data-ocid="strings.extract_button"
              onClick={handleExtract}
              disabled={isProcessing || (!fileBytes && !rawText.trim())}
              className="w-full font-mono text-xs bg-terminal-green/10 border border-terminal-green/40 text-terminal-green hover:bg-terminal-green/20 hover:border-terminal-green"
              variant="outline"
            >
              {isProcessing ? (
                <>
                  <div className="w-3 h-3 border border-terminal-green border-t-transparent rounded-full animate-spin mr-2" />
                  Extracting...
                </>
              ) : (
                <>
                  <Type className="w-3 h-3 mr-2" />
                  Extract Strings
                </>
              )}
            </Button>

            {results.length > 0 && (
              <div className="p-3 rounded border border-terminal-green/20 bg-terminal-green/5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-terminal-green">
                    {results.length.toLocaleString()} strings found
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyAll}
                    className="h-7 font-mono text-xs text-muted-foreground hover:text-terminal-cyan gap-1.5"
                  >
                    {copied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {copied ? "Copied!" : "Copy All"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results table */}
      {results.length > 0 && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="font-mono text-sm text-terminal-cyan">
                Extracted Strings
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="font-mono text-xs text-muted-foreground border-border"
                >
                  {results.length.toLocaleString()} results
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  data-ocid="strings.export_json.button"
                  onClick={() => handleExport("json")}
                  className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 gap-1.5 h-7"
                >
                  <Download className="w-3 h-3" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-ocid="strings.export_csv.button"
                  onClick={() => handleExport("csv")}
                  className="font-mono text-xs border-terminal-amber/40 text-terminal-amber hover:bg-terminal-amber/10 gap-1.5 h-7"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded border border-border overflow-hidden max-h-96 overflow-y-auto">
              <Table data-ocid="strings.results.table">
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest w-36">
                      Offset
                    </TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      String
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow
                      key={`${r.offset}-${i}`}
                      data-ocid={`strings.results.row.${i + 1}`}
                      className="border-border hover:bg-muted/20 font-mono text-xs"
                    >
                      <TableCell className="text-terminal-amber">
                        {r.offset}
                      </TableCell>
                      <TableCell className="text-terminal-green break-all">
                        {r.value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length === 0 && !isProcessing && (
        <div data-ocid="strings.results.empty_state" className="hidden" />
      )}
    </div>
  );
}
