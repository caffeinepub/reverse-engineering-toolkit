import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { AlertTriangle, Download, Table2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SUSPICIOUS_FUNCTIONS = new Set([
  "VirtualAlloc",
  "VirtualAllocEx",
  "WriteProcessMemory",
  "CreateRemoteThread",
  "NtUnmapViewOfSection",
  "SetWindowsHookEx",
  "GetAsyncKeyState",
  "RegSetValueEx",
  "InternetOpen",
  "URLDownloadToFile",
  "CreateService",
  "StartService",
]);

interface ImportEntry {
  dll: string;
  function: string;
  ordinal: string;
  suspicious: boolean;
}

function parseImportsFromBytes(bytes: Uint8Array): ImportEntry[] {
  // Check for MZ header
  if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
    return parsePEImports(bytes) ?? parseStringFallback(bytes);
  }
  return parseStringFallback(bytes);
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  );
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readCString(bytes: Uint8Array, offset: number, maxLen = 128): string {
  if (offset >= bytes.length) return "";
  const chars: number[] = [];
  for (let i = offset; i < Math.min(offset + maxLen, bytes.length); i++) {
    if (bytes[i] === 0) break;
    chars.push(bytes[i]);
  }
  try {
    return new TextDecoder("ascii", { fatal: false }).decode(
      new Uint8Array(chars),
    );
  } catch {
    return chars.map((c) => String.fromCharCode(c)).join("");
  }
}

function isPrintableASCII(s: string): boolean {
  return /^[\x20-\x7e]+$/.test(s);
}

function rvaToFileOffset(
  bytes: Uint8Array,
  rva: number,
  ntOffset: number,
): number {
  // Read section headers to convert RVA to file offset
  const optHdrSize = readU16LE(bytes, ntOffset + 20);
  const numSections = readU16LE(bytes, ntOffset + 6);
  const sectionTableOffset = ntOffset + 24 + optHdrSize;

  for (let i = 0; i < numSections; i++) {
    const secOffset = sectionTableOffset + i * 40;
    if (secOffset + 40 > bytes.length) break;
    const virtualAddr = readU32LE(bytes, secOffset + 12);
    const rawSize = readU32LE(bytes, secOffset + 16);
    const rawOffset = readU32LE(bytes, secOffset + 20);
    if (rva >= virtualAddr && rva < virtualAddr + Math.max(rawSize, 0x1000)) {
      return rawOffset + (rva - virtualAddr);
    }
  }
  // Fallback: assume RVA = file offset for flat files
  return rva;
}

function parsePEImports(bytes: Uint8Array): ImportEntry[] | null {
  try {
    if (bytes.length < 0x40) return null;
    const peOffset = readU32LE(bytes, 0x3c);
    if (peOffset + 4 > bytes.length) return null;

    // Check PE signature
    if (
      bytes[peOffset] !== 0x50 ||
      bytes[peOffset + 1] !== 0x45 ||
      bytes[peOffset + 2] !== 0 ||
      bytes[peOffset + 3] !== 0
    )
      return null;

    const magic = readU16LE(bytes, peOffset + 24);
    const is64 = magic === 0x20b;
    const importDirOffset = is64 ? peOffset + 24 + 112 : peOffset + 24 + 104;
    if (importDirOffset + 8 > bytes.length) return null;

    const importRVA = readU32LE(bytes, importDirOffset);
    if (importRVA === 0) return null;

    const importFO = rvaToFileOffset(bytes, importRVA, peOffset);
    if (importFO >= bytes.length) return null;

    const results: ImportEntry[] = [];
    let descriptorOffset = importFO;

    // Walk IMAGE_IMPORT_DESCRIPTORs (20 bytes each)
    for (let d = 0; d < 256; d++) {
      if (descriptorOffset + 20 > bytes.length) break;
      const nameRVA = readU32LE(bytes, descriptorOffset + 12);
      const iltRVA = readU32LE(bytes, descriptorOffset);
      if (nameRVA === 0 && iltRVA === 0) break;

      const nameFO = rvaToFileOffset(bytes, nameRVA, peOffset);
      const dllName = readCString(bytes, nameFO, 64);
      if (!dllName || !isPrintableASCII(dllName)) {
        descriptorOffset += 20;
        continue;
      }

      // Walk ILT/IAT
      const thunkRVA = iltRVA || readU32LE(bytes, descriptorOffset + 16);
      const thunkFO = rvaToFileOffset(bytes, thunkRVA, peOffset);
      let thunkOffset = thunkFO;
      const thunkSize = is64 ? 8 : 4;

      for (let t = 0; t < 1024; t++) {
        if (thunkOffset + thunkSize > bytes.length) break;
        const thunk = is64
          ? Number(
              BigInt(readU32LE(bytes, thunkOffset)) |
                (BigInt(readU32LE(bytes, thunkOffset + 4)) << 32n),
            )
          : readU32LE(bytes, thunkOffset);
        if (thunk === 0) break;

        const ordinalFlag = is64 ? thunk < 0 : (thunk & 0x80000000) !== 0;
        if (ordinalFlag) {
          const ord = thunk & 0xffff;
          results.push({
            dll: dllName,
            function: `Ordinal#${ord}`,
            ordinal: `0x${ord.toString(16)}`,
            suspicious: false,
          });
        } else {
          const hintRVA = thunk & (is64 ? 0x7fffffffffff : 0x7fffffff);
          const hintFO = rvaToFileOffset(bytes, hintRVA, peOffset);
          if (hintFO + 2 < bytes.length) {
            const funcName = readCString(bytes, hintFO + 2, 64);
            if (funcName && isPrintableASCII(funcName)) {
              results.push({
                dll: dllName,
                function: funcName,
                ordinal: "",
                suspicious: SUSPICIOUS_FUNCTIONS.has(funcName),
              });
            }
          }
        }
        thunkOffset += thunkSize;
      }
      descriptorOffset += 20;
    }

    return results.length > 0 ? results : null;
  } catch {
    return null;
  }
}

function parseStringFallback(bytes: Uint8Array): ImportEntry[] {
  const results: ImportEntry[] = [];
  const text = new TextDecoder("ascii", { fatal: false }).decode(bytes);
  const dllMatches = text.matchAll(/([A-Za-z0-9_]+\.dll)/gi);

  for (const match of dllMatches) {
    const dllName = match[1];
    // Find function names near this DLL reference by scanning for null-terminated ASCII strings
    const nearbyBytes = bytes.slice(
      Math.min(match.index ?? 0, bytes.length),
      Math.min((match.index ?? 0) + 512, bytes.length),
    );
    const funcs = new Set<string>();
    let i = 0;
    while (i < nearbyBytes.length) {
      if (nearbyBytes[i] === 0) {
        i++;
        const nameStart = i;
        let nameEnd = i;
        while (
          nameEnd < nearbyBytes.length &&
          nearbyBytes[nameEnd] !== 0 &&
          nearbyBytes[nameEnd] >= 0x21 &&
          nearbyBytes[nameEnd] <= 0x7e
        ) {
          nameEnd++;
        }
        const nameLen = nameEnd - nameStart;
        if (nameLen >= 3 && nameLen <= 31 && nearbyBytes[nameEnd] === 0) {
          const candidate = Array.from(nearbyBytes.slice(nameStart, nameEnd))
            .map((c) => String.fromCharCode(c))
            .join("");
          if (
            /^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate) &&
            !candidate.includes(".")
          ) {
            funcs.add(candidate);
          }
        }
        i = nameEnd + 1;
      } else {
        i++;
      }
    }
    if (funcs.size === 0) {
      results.push({
        dll: dllName,
        function: "(imports)",
        ordinal: "",
        suspicious: false,
      });
    } else {
      for (const fn of funcs) {
        results.push({
          dll: dllName,
          function: fn,
          ordinal: "",
          suspicious: SUSPICIOUS_FUNCTIONS.has(fn),
        });
      }
    }
  }
  return results;
}

export function ImportTableAnalyzer() {
  const [pasteInput, setPasteInput] = useState("");
  const [imports, setImports] = useState<ImportEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState("paste");
  const createSession = useCreateSession();

  const analyzeBytes = async (bytes: Uint8Array, filename: string) => {
    setIsLoading(true);
    try {
      const results = parseImportsFromBytes(bytes);
      setImports(results);

      const dllSet = new Set(results.map((r) => r.dll));
      const suspCount = results.filter((r) => r.suspicious).length;
      const summary = `${dllSet.size} DLLs, ${results.length} imports, ${suspCount} suspicious`;

      await createSession.mutateAsync({
        filename,
        tool: "Import Table Analyzer",
        resultSummary: summary,
      });
      toast.success("Analysis complete");
    } catch {
      toast.error("Failed to analyze");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzePaste = () => {
    if (!pasteInput.trim()) {
      toast.error("Paste hex bytes first");
      return;
    }
    const clean = pasteInput.replace(/\s/g, "");
    if (clean.length % 2 !== 0) {
      toast.error("Invalid hex string");
      return;
    }
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16);
    }
    analyzeBytes(bytes, "pasted_input.bin");
  };

  const handleFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    analyzeBytes(new Uint8Array(buf), file.name);
  };

  const exportJSON = () => {
    if (!imports) return;
    const blob = new Blob([JSON.stringify(imports, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "imports.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported JSON");
  };

  const exportCSV = () => {
    if (!imports) return;
    const rows = [
      "DLL,Function,Ordinal,Suspicious",
      ...imports.map(
        (i) => `"${i.dll}","${i.function}","${i.ordinal}","${i.suspicious}"`,
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "imports.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  const dllCount = imports ? new Set(imports.map((i) => i.dll)).size : 0;
  const suspCount = imports ? imports.filter((i) => i.suspicious).length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ import-table-analyzer
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Parse PE import tables — detect suspicious API calls
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="bg-card border border-border h-9">
          <TabsTrigger
            value="paste"
            data-ocid="imports.tab.1"
            className="font-mono text-xs data-[state=active]:bg-terminal-bg data-[state=active]:text-terminal-green"
          >
            Paste Hex
          </TabsTrigger>
          <TabsTrigger
            value="upload"
            data-ocid="imports.tab.2"
            className="font-mono text-xs data-[state=active]:bg-terminal-bg data-[state=active]:text-terminal-green"
          >
            Upload File
          </TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="space-y-3">
          <Textarea
            data-ocid="imports.paste.textarea"
            value={pasteInput}
            onChange={(e) => setPasteInput(e.target.value)}
            placeholder="Paste hex bytes of the binary or import section..."
            className="font-mono text-xs bg-terminal-bg border-border text-terminal-green placeholder:text-muted-foreground/40 resize-none h-32"
          />
          <Button
            data-ocid="imports.analyze.button"
            onClick={handleAnalyzePaste}
            disabled={isLoading}
            className="font-mono text-xs bg-terminal-green/10 border border-terminal-green/40 text-terminal-green hover:bg-terminal-green/20"
            variant="outline"
          >
            {isLoading ? "Analyzing..." : "Analyze"}
          </Button>
        </TabsContent>

        <TabsContent value="upload">
          <label
            data-ocid="imports.upload_button"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={cn(
              "relative border-2 border-dashed rounded p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
              isDragging
                ? "border-terminal-green bg-terminal-green/5"
                : "border-border hover:border-terminal-green/50 hover:bg-muted/20",
            )}
          >
            <input
              type="file"
              className="hidden"
              accept=".exe,.dll,.sys,.bin,.ocx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Upload className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="font-mono text-sm text-foreground font-medium">
              Drop PE file (.exe, .dll, .sys)
            </p>
          </label>
        </TabsContent>
      </Tabs>

      {isLoading && (
        <div
          data-ocid="imports.loading_state"
          className="flex items-center gap-3 p-4 rounded border border-terminal-green/30 bg-terminal-green/5"
        >
          <div className="w-4 h-4 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-terminal-green">
            Parsing import table...
          </span>
        </div>
      )}

      {imports !== null && !isLoading && (
        <div data-ocid="imports.results.panel" className="space-y-4">
          {/* Summary */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              variant="outline"
              className="font-mono text-xs border-terminal-green/40 text-terminal-green"
            >
              {dllCount} DLLs
            </Badge>
            <Badge
              variant="outline"
              className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan"
            >
              {imports.length} functions
            </Badge>
            {suspCount > 0 && (
              <Badge
                variant="outline"
                className="font-mono text-xs border-destructive/40 text-destructive"
              >
                <AlertTriangle className="w-3 h-3 mr-1" />
                {suspCount} suspicious
              </Badge>
            )}
            <div className="flex-1" />
            <Button
              size="sm"
              variant="outline"
              data-ocid="imports.export_json.button"
              onClick={exportJSON}
              className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 gap-1.5 h-7"
            >
              <Download className="w-3 h-3" />
              JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-ocid="imports.export_csv.button"
              onClick={exportCSV}
              className="font-mono text-xs border-terminal-amber/40 text-terminal-amber hover:bg-terminal-amber/10 gap-1.5 h-7"
            >
              <Download className="w-3 h-3" />
              CSV
            </Button>
          </div>

          {imports.length === 0 ? (
            <div
              data-ocid="imports.empty_state"
              className="text-center py-12 rounded border border-border"
            >
              <Table2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-xs text-muted-foreground">
                No imports found. Try uploading a PE binary.
              </p>
            </div>
          ) : (
            <Card className="border-border bg-card/60">
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[500px]">
                  <Table data-ocid="imports.table">
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                          DLL
                        </TableHead>
                        <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                          Function
                        </TableHead>
                        <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                          Ordinal
                        </TableHead>
                        <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                          Flag
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {imports.map((entry, idx) => (
                        <TableRow
                          key={`${entry.dll}-${entry.function}-${idx}`}
                          className={cn(
                            "border-border hover:bg-muted/20 font-mono text-xs",
                            entry.suspicious && "bg-destructive/5",
                          )}
                        >
                          <TableCell className="text-terminal-cyan">
                            {entry.dll}
                          </TableCell>
                          <TableCell
                            className={
                              entry.suspicious
                                ? "text-destructive font-semibold"
                                : "text-terminal-green"
                            }
                          >
                            {entry.function}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {entry.ordinal || "—"}
                          </TableCell>
                          <TableCell>
                            {entry.suspicious && (
                              <Badge
                                variant="outline"
                                className="font-mono text-xs border-destructive/40 text-destructive gap-1"
                              >
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Suspicious
                              </Badge>
                            )}
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
    </div>
  );
}
