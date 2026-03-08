import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { AlertCircle, BinaryIcon, Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface FileAnalysis {
  name: string;
  size: number;
  type: string;
  magicBytes: string;
  entropy: number;
  hexDump: HexRow[];
}

interface HexRow {
  address: string;
  hex: string[];
  ascii: string;
}

function calculateEntropy(bytes: Uint8Array): number {
  const freq = new Array(256).fill(0);
  for (const b of bytes) freq[b]++;
  let entropy = 0;
  const len = bytes.length;
  for (const f of freq) {
    if (f > 0) {
      const p = f / len;
      entropy -= p * Math.log2(p);
    }
  }
  return entropy;
}

function buildHexDump(bytes: Uint8Array, maxRows = 64): HexRow[] {
  const rows: HexRow[] = [];
  for (let i = 0; i < Math.min(bytes.length, maxRows * 16); i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const address = i.toString(16).padStart(8, "0");
    const hex: string[] = [];
    for (let j = 0; j < 16; j++) {
      if (j < chunk.length) {
        hex.push(chunk[j].toString(16).padStart(2, "0"));
      } else {
        hex.push("  ");
      }
    }
    let ascii = "";
    for (const b of chunk) {
      ascii += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".";
    }
    rows.push({ address, hex, ascii });
  }
  return rows;
}

function getMimeGuess(type: string, magic: string): string {
  if (type) return type;
  const m = magic.toLowerCase();
  if (m.startsWith("4d5a")) return "application/x-msdownload (PE)";
  if (m.startsWith("7f454c46")) return "application/x-elf";
  if (m.startsWith("cafebabe")) return "application/java-vm";
  if (m.startsWith("504b")) return "application/zip";
  if (m.startsWith("ffd8ff")) return "image/jpeg";
  if (m.startsWith("89504e47")) return "image/png";
  return "application/octet-stream";
}

export function BinaryAnalyzer() {
  const [analysis, setAnalysis] = useState<FileAnalysis | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createSession = useCreateSession();

  const handleExport = (format: "json" | "csv") => {
    if (!analysis) return;
    if (format === "json") {
      const data = {
        filename: analysis.name,
        size: analysis.size,
        type: analysis.type,
        magicBytes: analysis.magicBytes,
        entropy: analysis.entropy,
        hexDump: analysis.hexDump,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${analysis.name}.hexdump.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const rows = ["Address,Hex,ASCII"];
      for (const row of analysis.hexDump) {
        rows.push(`${row.address},"${row.hex.join(" ")}","${row.ascii}"`);
      }
      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${analysis.name}.hexdump.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const analyzeFile = async (file: File) => {
    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const magic = Array.from(bytes.slice(0, 4))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")
        .toUpperCase();
      const entropy = calculateEntropy(bytes);
      const hexDump = buildHexDump(bytes);
      const result: FileAnalysis = {
        name: file.name,
        size: file.size,
        type: getMimeGuess(file.type, magic.replace(/ /g, "")),
        magicBytes: magic,
        entropy,
        hexDump,
      };
      setAnalysis(result);

      const summary = `Size: ${file.size} bytes | Magic: ${magic} | Entropy: ${entropy.toFixed(3)} bits/byte`;
      await createSession.mutateAsync({
        filename: file.name,
        tool: "Binary Analyzer",
        resultSummary: summary,
      });
      toast.success("Analysis complete. Session saved.");
    } catch {
      toast.error("Failed to analyze file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analyzeFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) analyzeFile(file);
  };

  const entropyLabel = (e: number) => {
    if (e > 7.5)
      return { label: "High (packed/encrypted)", color: "text-destructive" };
    if (e > 6)
      return { label: "Medium (compressed)", color: "text-terminal-amber" };
    return { label: "Low (plaintext/code)", color: "text-terminal-green" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ binary-analyzer
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Hex dump, metadata extraction, and entropy analysis
        </p>
      </div>

      {/* Upload area */}
      <label
        data-ocid="binary.upload_button"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
          isDragging
            ? "border-terminal-green bg-terminal-green/5 glow-green"
            : "border-border hover:border-terminal-green/50 hover:bg-muted/20",
        )}
      >
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />
        <Upload className="w-8 h-8 text-muted-foreground mb-3" />
        <p className="font-mono text-sm text-foreground font-medium">
          Drop any file or click to upload
        </p>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          PE, ELF, shellcode, firmware, any binary
        </p>
      </label>

      {isLoading && (
        <div
          data-ocid="binary.loading_state"
          className="flex items-center gap-3 p-4 rounded border border-terminal-green/30 bg-terminal-green/5"
        >
          <div className="w-4 h-4 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-terminal-green">
            Analyzing binary...
          </span>
        </div>
      )}

      {analysis && !isLoading && (
        <div className="space-y-4">
          {/* Metadata */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
                <BinaryIcon className="w-4 h-4" />
                File Metadata
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Filename", value: analysis.name },
                  {
                    label: "Size",
                    value: `${analysis.size.toLocaleString()} bytes`,
                  },
                  { label: "MIME Type", value: analysis.type },
                  { label: "Magic Bytes", value: analysis.magicBytes },
                  {
                    label: "Entropy",
                    value: `${analysis.entropy.toFixed(4)} bits/byte`,
                    extra: entropyLabel(analysis.entropy),
                  },
                ].map((field) => (
                  <div key={field.label} className="space-y-1">
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      {field.label}
                    </p>
                    <p className="font-mono text-xs text-foreground break-all">
                      {field.value}
                    </p>
                    {field.extra && (
                      <p className={`font-mono text-xs ${field.extra.color}`}>
                        {field.extra.label}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Hex dump */}
          <Card
            data-ocid="binary.hex_dump.panel"
            className="border-border bg-card/60"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="font-mono text-sm text-terminal-cyan">
                  Hex Dump
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="font-mono text-xs text-muted-foreground border-border"
                  >
                    First{" "}
                    {Math.min(
                      analysis.hexDump.length * 16,
                      analysis.size,
                    ).toLocaleString()}{" "}
                    bytes
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    data-ocid="binary.export_json.button"
                    onClick={() => handleExport("json")}
                    className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 gap-1.5 h-7"
                  >
                    <Download className="w-3 h-3" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-ocid="binary.export_csv.button"
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
              <div className="overflow-x-auto rounded border border-border bg-terminal-bg p-3">
                <table className="hex-table w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-muted-foreground pr-4 pb-2 font-normal w-24">
                        Address
                      </th>
                      <th className="text-left text-muted-foreground pr-4 pb-2 font-normal">
                        Hex
                      </th>
                      <th className="text-left text-muted-foreground pb-2 font-normal">
                        ASCII
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.hexDump.map((row) => (
                      <tr key={row.address} className="hover:bg-white/5">
                        <td className="text-terminal-amber pr-4 py-0.5 select-none">
                          {row.address}
                        </td>
                        <td className="pr-4 py-0.5">
                          <span className="flex gap-1 flex-wrap">
                            {row.hex.map((h, colIdx) => (
                              <span
                                key={`${row.address}-col-${colIdx}`}
                                className={cn(
                                  "inline-block w-5",
                                  h.trim() === ""
                                    ? "opacity-0"
                                    : h === "00"
                                      ? "text-muted-foreground/40"
                                      : "text-terminal-green",
                                )}
                              >
                                {h}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="py-0.5 text-terminal-cyan">
                          {row.ascii}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {analysis.size > analysis.hexDump.length * 16 && (
                <p className="font-mono text-xs text-muted-foreground mt-2 flex items-center gap-2">
                  <AlertCircle className="w-3 h-3" />
                  Showing first{" "}
                  {(analysis.hexDump.length * 16).toLocaleString()} of{" "}
                  {analysis.size.toLocaleString()} bytes
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
