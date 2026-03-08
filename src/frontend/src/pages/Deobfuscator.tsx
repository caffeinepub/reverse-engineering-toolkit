import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSession } from "@/hooks/useQueries";
import { Check, Copy, Shuffle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Decode helpers ───────────────────────────────────────────────────────────

function decodeBase64(input: string): string | null {
  try {
    const decoded = atob(input.trim());
    if ([...decoded].some((c) => c.charCodeAt(0) < 9)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function decodeROT13(input: string): string {
  return input.replace(/[A-Za-z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function decodeXOR(input: string, key: number): string | null {
  try {
    const bytes = new TextEncoder().encode(input);
    const out = bytes.map((b) => b ^ key);
    const str = new TextDecoder().decode(out);
    if ([...str].some((c) => c.charCodeAt(0) < 9)) return null;
    return str;
  } catch {
    return null;
  }
}

function decodeURL(input: string): string | null {
  try {
    const decoded = decodeURIComponent(input);
    if (decoded === input) return null;
    return decoded;
  } catch {
    return null;
  }
}

function decodeHTMLEntities(input: string): string | null {
  const div = document.createElement("div");
  div.innerHTML = input;
  const decoded = div.textContent ?? "";
  if (decoded === input) return null;
  return decoded;
}

function decodeHexString(input: string): string | null {
  const clean = input.replace(/\s/g, "");
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length % 2 !== 0) return null;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(Number.parseInt(clean.slice(i, i + 2), 16));
  }
  if (bytes.some((b) => b < 9)) return null;
  return bytes.map((b) => String.fromCharCode(b)).join("");
}

function isPrintable(s: string): boolean {
  if (!s || s.trim() === "") return false;
  return [...s].every((c) => {
    const code = c.charCodeAt(0);
    return code >= 9 && code < 127;
  });
}

interface DecodeResult {
  method: string;
  result: string | null;
  applicable: boolean;
}

export function Deobfuscator() {
  const [input, setInput] = useState("");
  const [xorKey, setXorKey] = useState(0x41);
  const [results, setResults] = useState<DecodeResult[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [hasDecoded, setHasDecoded] = useState(false);
  const createSession = useCreateSession();

  const handleDecode = async () => {
    if (!input.trim()) {
      toast.error("Enter some text to decode");
      return;
    }

    const decoded: DecodeResult[] = [
      (() => {
        const r = decodeBase64(input);
        return {
          method: "Base64",
          result: r,
          applicable: r !== null && isPrintable(r),
        };
      })(),
      (() => {
        const r = decodeROT13(input);
        return {
          method: "ROT13",
          result: r,
          applicable: r !== input,
        };
      })(),
      (() => {
        const r = decodeXOR(input, xorKey);
        return {
          method: `XOR 0x${xorKey.toString(16).padStart(2, "0").toUpperCase()}`,
          result: r,
          applicable: r !== null && isPrintable(r),
        };
      })(),
      (() => {
        const r = decodeURL(input);
        return {
          method: "URL Decode",
          result: r,
          applicable: r !== null,
        };
      })(),
      (() => {
        const r = decodeHTMLEntities(input);
        return {
          method: "HTML Entities",
          result: r,
          applicable: r !== null && isPrintable(r),
        };
      })(),
      (() => {
        const r = decodeHexString(input);
        return {
          method: "Hex → ASCII",
          result: r,
          applicable: r !== null && isPrintable(r),
        };
      })(),
    ];

    setResults(decoded);
    setHasDecoded(true);

    const applicableCount = decoded.filter((d) => d.applicable).length;
    try {
      await createSession.mutateAsync({
        filename: "input.txt",
        tool: "Deobfuscator",
        resultSummary: `${input.length} chars decoded with ${applicableCount} methods`,
      });
    } catch {
      // session save is non-critical
    }
    toast.success(`Decoded with ${applicableCount} applicable method(s)`);
  };

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ deobfuscator
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Decode obfuscated or encoded input using multiple methods
          simultaneously
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Input */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
                <Shuffle className="w-4 h-4" />
                Input
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                data-ocid="deobfuscator.input.textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste obfuscated or encoded text here..."
                className="font-mono text-xs bg-terminal-bg border-border text-terminal-green placeholder:text-muted-foreground/40 resize-none h-40"
                spellCheck={false}
              />
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-sm text-terminal-cyan">
                Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-mono text-xs text-muted-foreground">
                    XOR Key
                  </Label>
                  <Badge
                    variant="outline"
                    className="font-mono text-xs text-terminal-amber border-terminal-amber/30"
                  >
                    0x{xorKey.toString(16).padStart(2, "0").toUpperCase()}
                  </Badge>
                </div>
                <Slider
                  data-ocid="deobfuscator.xor_key.input"
                  value={[xorKey]}
                  onValueChange={([v]) => setXorKey(v)}
                  min={0}
                  max={255}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between font-mono text-xs text-muted-foreground/50">
                  <span>0x00</span>
                  <span>0xFF</span>
                </div>
                <Input
                  value={`0x${xorKey.toString(16).padStart(2, "0").toUpperCase()}`}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 16);
                    if (!Number.isNaN(v) && v >= 0 && v <= 255) setXorKey(v);
                  }}
                  className="font-mono text-xs bg-terminal-bg border-border text-terminal-amber h-8"
                />
              </div>

              <Button
                data-ocid="deobfuscator.decode.primary_button"
                onClick={handleDecode}
                disabled={!input.trim()}
                className="w-full font-mono text-xs bg-terminal-green/10 border border-terminal-green/40 text-terminal-green hover:bg-terminal-green/20"
                variant="outline"
              >
                <Shuffle className="w-3 h-3 mr-2" />
                Decode All Methods
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results grid */}
      {hasDecoded && (
        <div>
          <h2 className="font-mono text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Decode Results
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {results.map((r, idx) => (
              <Card
                key={r.method}
                data-ocid={`deobfuscator.results.card.${idx + 1}`}
                className={`border-border bg-card/60 ${r.applicable ? "border-terminal-green/20" : ""}`}
              >
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-terminal-cyan">
                      {r.method}
                    </span>
                    {r.applicable ? (
                      <Badge
                        variant="outline"
                        className="font-mono text-xs text-terminal-green border-terminal-green/30 bg-terminal-green/5"
                      >
                        ✓ applicable
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="font-mono text-xs text-muted-foreground border-border"
                      >
                        n/a
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  {r.applicable && r.result ? (
                    <div className="space-y-2">
                      <div className="bg-terminal-bg rounded p-2 max-h-28 overflow-y-auto">
                        <p className="font-mono text-xs text-terminal-green break-all whitespace-pre-wrap">
                          {r.result}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-ocid={`deobfuscator.results.secondary_button.${idx + 1}`}
                        onClick={() => handleCopy(r.result!, idx)}
                        className="h-6 font-mono text-xs text-muted-foreground hover:text-terminal-cyan gap-1.5 px-2"
                      >
                        {copiedIdx === idx ? (
                          <Check className="w-3 h-3 text-terminal-green" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedIdx === idx ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  ) : (
                    <p className="font-mono text-xs text-muted-foreground/40 italic">
                      Not applicable or non-printable output
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!hasDecoded && (
        <div
          data-ocid="deobfuscator.results.empty_state"
          className="flex flex-col items-center justify-center py-16 gap-3 text-center"
        >
          <div className="w-12 h-12 rounded border border-border flex items-center justify-center">
            <Shuffle className="w-5 h-5 text-muted-foreground/40" />
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Paste encoded text above and click Decode All Methods
          </p>
        </div>
      )}
    </div>
  );
}
