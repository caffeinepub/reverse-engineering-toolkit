import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { AlertCircle, ScanSearch, Search, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface ScanMatch {
  offsetHex: string;
  offsetDec: number;
  context: string;
}

function scanPattern(haystack: Uint8Array, patternHex: string): ScanMatch[] {
  const tokens = patternHex
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-f?\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return [];

  // Parse pattern with wildcard support (?)
  const pattern: (number | null)[] = tokens.map((t) =>
    t === "?" || t === "??" ? null : Number.parseInt(t, 16),
  );

  const matches: ScanMatch[] = [];
  const pLen = pattern.length;

  for (let i = 0; i <= haystack.length - pLen; i++) {
    let match = true;
    for (let j = 0; j < pLen; j++) {
      if (pattern[j] !== null && haystack[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      const contextStart = Math.max(0, i - 4);
      const contextEnd = Math.min(haystack.length, i + pLen + 4);
      const contextBytes = Array.from(haystack.slice(contextStart, contextEnd))
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join(" ");
      matches.push({
        offsetHex: `0x${i.toString(16).padStart(8, "0")}`,
        offsetDec: i,
        context: contextBytes,
      });
      if (matches.length >= 1000) break;
    }
  }
  return matches;
}

const EXAMPLE_PATTERNS = [
  { label: "FF D8 FF E0", desc: "JPEG header" },
  { label: "89 50 4E 47", desc: "PNG header" },
  { label: "4D 5A", desc: "PE/DOS magic" },
  { label: "7F 45 4C 46", desc: "ELF magic" },
  { label: "EB ? 90 90", desc: "JMP + NOPs (with wildcard)" },
];

export function PatternScanner() {
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [filename, setFilename] = useState("");
  const [pattern, setPattern] = useState("FF D8 FF E0");
  const [results, setResults] = useState<ScanMatch[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createSession = useCreateSession();

  const handleFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    setFileBytes(new Uint8Array(buffer));
    setFilename(file.name);
    setResults(null);
    toast.success(`Loaded: ${file.name}`);
  };

  const handleScan = async () => {
    if (!fileBytes) {
      toast.error("Load a file first");
      return;
    }
    if (!pattern.trim()) {
      toast.error("Enter a hex pattern");
      return;
    }
    setIsScanning(true);
    try {
      const matches = scanPattern(fileBytes, pattern);
      setResults(matches);

      await createSession.mutateAsync({
        filename,
        tool: "Pattern Scanner",
        resultSummary: `Pattern "${pattern}" → ${matches.length} match${matches.length !== 1 ? "es" : ""} in ${filename}`,
      });
      toast.success(
        `Found ${matches.length} match${matches.length !== 1 ? "es" : ""}`,
      );
    } catch {
      toast.error("Scan failed");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ pattern-scanner
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Scan binary files for hex byte patterns with wildcard support
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upload */}
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Target File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <label
              data-ocid="scanner.upload_button"
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
                "border-2 border-dashed rounded p-8 flex flex-col items-center cursor-pointer transition-all",
                isDragging
                  ? "border-terminal-green bg-terminal-green/5"
                  : "border-border hover:border-terminal-green/50",
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
              <Upload className="w-6 h-6 text-muted-foreground mb-2" />
              <p className="font-mono text-xs text-foreground">
                {filename || "Drop file or click to upload"}
              </p>
              {fileBytes && (
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  {fileBytes.length.toLocaleString()} bytes loaded
                </p>
              )}
            </label>
          </CardContent>
        </Card>

        {/* Pattern input */}
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
              <Search className="w-4 h-4" />
              Pattern
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs text-muted-foreground">
                Hex pattern (use <span className="text-terminal-amber">?</span>{" "}
                for wildcards)
              </Label>
              <Input
                data-ocid="scanner.pattern.input"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="FF D8 FF E0"
                className="font-mono text-xs bg-terminal-bg border-border text-terminal-green placeholder:text-muted-foreground/40"
                spellCheck={false}
              />
            </div>

            {/* Quick patterns */}
            <div className="space-y-2">
              <p className="font-mono text-xs text-muted-foreground">
                Quick patterns:
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PATTERNS.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => setPattern(p.label)}
                    className="font-mono text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:border-terminal-cyan/40 hover:text-terminal-cyan transition-colors"
                    title={p.desc}
                  >
                    {p.label}
                    <span className="ml-1 text-muted-foreground/50">
                      {`// ${p.desc}`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              data-ocid="scanner.scan_button"
              onClick={handleScan}
              disabled={isScanning || !fileBytes || !pattern.trim()}
              className="w-full font-mono text-xs bg-terminal-green/10 border border-terminal-green/40 text-terminal-green hover:bg-terminal-green/20"
              variant="outline"
            >
              {isScanning ? (
                <>
                  <div className="w-3 h-3 border border-terminal-green border-t-transparent rounded-full animate-spin mr-2" />
                  Scanning...
                </>
              ) : (
                <>
                  <ScanSearch className="w-3 h-3 mr-2" />
                  Scan File
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {results !== null && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
                <ScanSearch className="w-4 h-4" />
                Scan Results
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-xs",
                  results.length > 0
                    ? "text-terminal-green border-terminal-green/30"
                    : "text-muted-foreground border-border",
                )}
              >
                {results.length} match{results.length !== 1 ? "es" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div
                data-ocid="scanner.results.empty_state"
                className="flex flex-col items-center justify-center py-10 gap-3"
              >
                <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
                <p className="font-mono text-xs text-muted-foreground">
                  No matches found for pattern{" "}
                  <span className="text-terminal-amber">{pattern}</span>
                </p>
              </div>
            ) : (
              <div
                data-ocid="scanner.results.list"
                className="space-y-1 max-h-80 overflow-y-auto"
              >
                {results.map((r, i) => (
                  <div
                    key={`${r.offsetHex}-${i}`}
                    data-ocid={`scanner.results.item.${i + 1}`}
                    className="flex items-center gap-4 p-2 rounded border border-border hover:border-terminal-green/30 hover:bg-terminal-green/5 transition-all font-mono text-xs"
                  >
                    <span className="text-terminal-amber w-28 shrink-0">
                      {r.offsetHex}
                    </span>
                    <span className="text-muted-foreground w-16 shrink-0">
                      {r.offsetDec.toLocaleString()}
                    </span>
                    <span className="text-terminal-cyan truncate">
                      {r.context}
                    </span>
                  </div>
                ))}
                {results.length >= 1000 && (
                  <div className="flex items-center gap-2 p-2 font-mono text-xs text-terminal-amber">
                    <AlertCircle className="w-3 h-3" />
                    Showing first 1,000 matches
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
