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
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Check, Copy, Download, Hash, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

// ─── CRC32 ───────────────────────────────────────────────────────────────────
function makeCRC32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
}
const CRC32_TABLE = makeCRC32Table();

function crc32(bytes: Uint8Array): string {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc = CRC32_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0").toUpperCase();
}

// ─── MD5 ─────────────────────────────────────────────────────────────────────
function md5(bytes: Uint8Array): string {
  const K: number[] = [];
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  }
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
    16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21,
  ];

  const origLen = bytes.length;
  const bitLen = origLen * 8;

  // Padding
  const padded: number[] = Array.from(bytes);
  padded.push(0x80);
  while (padded.length % 64 !== 56) padded.push(0);
  for (let i = 0; i < 8; i++) {
    padded.push((bitLen / 2 ** (8 * i)) & 0xff);
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const add32 = (x: number, y: number) => (x + y) & 0xffffffff;
  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    const M: number[] = [];
    for (let j = 0; j < 16; j++) {
      M[j] =
        padded[chunk + j * 4] |
        (padded[chunk + j * 4 + 1] << 8) |
        (padded[chunk + j * 4 + 2] << 16) |
        (padded[chunk + j * 4 + 3] << 24);
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const temp = D;
      D = C;
      C = B;
      B = add32(B, rotl(add32(add32(A, F), add32(K[i], M[g])), S[i]));
      A = temp;
    }
    a0 = add32(a0, A);
    b0 = add32(b0, B);
    c0 = add32(c0, C);
    d0 = add32(d0, D);
  }

  const hex = (n: number) => {
    let s = "";
    for (let i = 0; i < 4; i++)
      s += ((n >>> (8 * i)) & 0xff).toString(16).padStart(2, "0");
    return s;
  };
  return (hex(a0) + hex(b0) + hex(c0) + hex(d0)).toUpperCase();
}

// ─── SubtleCrypto helpers ─────────────────────────────────────────────────────
async function sha(algorithm: string, bytes: Uint8Array): Promise<string> {
  const hashBuf = await crypto.subtle.digest(
    algorithm,
    bytes.buffer as ArrayBuffer,
  );
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

interface ChecksumResult {
  algorithm: string;
  hash: string;
}

export function Checksums() {
  const [results, setResults] = useState<ChecksumResult[]>([]);
  const [filename, setFilename] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const createSession = useCreateSession();

  const computeChecksums = async (file: File) => {
    setIsComputing(true);
    setFilename(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      const [sha1, sha256, sha512] = await Promise.all([
        sha("SHA-1", bytes),
        sha("SHA-256", bytes),
        sha("SHA-512", bytes),
      ]);

      const crc32val = crc32(bytes);
      const md5val = md5(bytes);

      const computed: ChecksumResult[] = [
        { algorithm: "MD5", hash: md5val },
        { algorithm: "CRC32", hash: crc32val },
        { algorithm: "SHA-1", hash: sha1 },
        { algorithm: "SHA-256", hash: sha256 },
        { algorithm: "SHA-512", hash: sha512 },
      ];
      setResults(computed);

      const sha256short = sha256.substring(0, 16);
      await createSession.mutateAsync({
        filename: file.name,
        tool: "Checksums",
        resultSummary: `SHA256: ${sha256short}... | CRC32: ${crc32val}`,
      });
      toast.success("Checksums computed and session saved.");
    } catch {
      toast.error("Failed to compute checksums");
    } finally {
      setIsComputing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) computeChecksums(file);
  };

  const handleCopy = async (hash: string, idx: number) => {
    await navigator.clipboard.writeText(hash);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast.success("Copied to clipboard");
  };

  const handleExportJSON = () => {
    const data = { filename, checksums: results };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename || "checksums"}.checksums.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as JSON");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ checksums
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Compute MD5, CRC32, SHA-1, SHA-256, SHA-512 for any file
        </p>
      </div>

      {/* Drop zone */}
      <label
        data-ocid="checksums.upload_button"
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
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) computeChecksums(f);
          }}
        />
        <Hash className="w-8 h-8 text-muted-foreground mb-3" />
        <p className="font-mono text-sm text-foreground font-medium">
          {filename ? filename : "Drop any file or click to upload"}
        </p>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Computes MD5, CRC32, SHA-1, SHA-256, SHA-512 client-side
        </p>
      </label>

      {isComputing && (
        <div
          data-ocid="checksums.loading_state"
          className="flex items-center gap-3 p-4 rounded border border-terminal-green/30 bg-terminal-green/5"
        >
          <div className="w-4 h-4 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-terminal-green">
            Computing checksums...
          </span>
        </div>
      )}

      {results.length > 0 && !isComputing && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Checksum Results — {filename}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  data-ocid="checksums.export.button"
                  onClick={handleExportJSON}
                  className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 gap-1.5"
                >
                  <Download className="w-3 h-3" />
                  Export JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded border border-border overflow-hidden">
              <Table data-ocid="checksums.results.table">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest w-28">
                      Algorithm
                    </TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      Hash Value
                    </TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest w-20 text-right">
                      Copy
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, idx) => (
                    <TableRow
                      key={r.algorithm}
                      data-ocid={`checksums.results.row.${idx + 1}`}
                      className="border-border hover:bg-muted/20 font-mono text-xs"
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs text-terminal-amber border-terminal-amber/30 bg-terminal-amber/5"
                        >
                          {r.algorithm}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-terminal-green break-all">
                        {r.hash}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          data-ocid={`checksums.results.delete_button.${idx + 1}`}
                          onClick={() => handleCopy(r.hash, idx)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-terminal-cyan"
                          title="Copy hash"
                        >
                          {copiedIdx === idx ? (
                            <Check className="w-3 h-3 text-terminal-green" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length === 0 && !isComputing && (
        <div
          data-ocid="checksums.results.empty_state"
          className="flex flex-col items-center justify-center py-16 gap-3 text-center"
        >
          <div className="w-12 h-12 rounded border border-border flex items-center justify-center">
            <Hash className="w-5 h-5 text-muted-foreground/40" />
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {/* Drop a file above to compute checksums */}
            Drop a file above to compute checksums
          </p>
        </div>
      )}
    </div>
  );
}
