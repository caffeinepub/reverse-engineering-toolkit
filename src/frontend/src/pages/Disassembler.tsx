import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSession } from "@/hooks/useQueries";
import { AlertCircle, Code2, Cpu } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Arch = "x86" | "x64";

interface Instruction {
  address: string;
  rawBytes: string;
  mnemonic: string;
  operands: string;
}

// x86/x64 mock instruction tables
const X86_INSTRUCTIONS: Record<
  string,
  { mnemonic: string; operands: string; size: number }
> = {
  "55": { mnemonic: "PUSH", operands: "RBP", size: 1 },
  "5d": { mnemonic: "POP", operands: "RBP", size: 1 },
  c3: { mnemonic: "RET", operands: "", size: 1 },
  "90": { mnemonic: "NOP", operands: "", size: 1 },
  cc: { mnemonic: "INT3", operands: "", size: 1 },
  eb: { mnemonic: "JMP SHORT", operands: "+rel8", size: 2 },
  e9: { mnemonic: "JMP", operands: "rel32", size: 5 },
  "74": { mnemonic: "JE", operands: "rel8", size: 2 },
  "75": { mnemonic: "JNE", operands: "rel8", size: 2 },
  "8b": { mnemonic: "MOV", operands: "r32, r/m32", size: 2 },
  "89": { mnemonic: "MOV", operands: "r/m32, r32", size: 2 },
  "31": { mnemonic: "XOR", operands: "r/m32, r32", size: 2 },
  "33": { mnemonic: "XOR", operands: "r32, r/m32", size: 2 },
  "01": { mnemonic: "ADD", operands: "r/m32, r32", size: 2 },
  "03": { mnemonic: "ADD", operands: "r32, r/m32", size: 2 },
  "29": { mnemonic: "SUB", operands: "r/m32, r32", size: 2 },
  "2b": { mnemonic: "SUB", operands: "r32, r/m32", size: 2 },
  f7: { mnemonic: "IMUL/IDIV", operands: "r/m32", size: 2 },
  ff: { mnemonic: "CALL/JMP", operands: "r/m64", size: 2 },
  e8: { mnemonic: "CALL", operands: "rel32", size: 5 },
  "48": { mnemonic: "REX.W", operands: "prefix", size: 1 },
  "83": { mnemonic: "ADD/SUB/CMP", operands: "r/m32, imm8", size: 3 },
  "85": { mnemonic: "TEST", operands: "r/m32, r32", size: 2 },
  "39": { mnemonic: "CMP", operands: "r/m32, r32", size: 2 },
  "3b": { mnemonic: "CMP", operands: "r32, r/m32", size: 2 },
  "50": { mnemonic: "PUSH", operands: "RAX", size: 1 },
  "51": { mnemonic: "PUSH", operands: "RCX", size: 1 },
  "52": { mnemonic: "PUSH", operands: "RDX", size: 1 },
  "53": { mnemonic: "PUSH", operands: "RBX", size: 1 },
  "58": { mnemonic: "POP", operands: "RAX", size: 1 },
  "59": { mnemonic: "POP", operands: "RCX", size: 1 },
  "5a": { mnemonic: "POP", operands: "RDX", size: 1 },
  "5b": { mnemonic: "POP", operands: "RBX", size: 1 },
};

function mockDisassemble(hexInput: string, _arch: Arch): Instruction[] {
  const tokens = hexInput
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-f\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const instructions: Instruction[] = [];
  let offset = 0;
  let i = 0;

  while (i < tokens.length && instructions.length < 128) {
    const byte = tokens[i];
    const info = X86_INSTRUCTIONS[byte];
    if (info) {
      const consumed = Math.min(info.size, tokens.length - i);
      const rawBytes = tokens
        .slice(i, i + consumed)
        .join(" ")
        .toUpperCase();
      instructions.push({
        address: `0x${offset.toString(16).padStart(8, "0")}`,
        rawBytes,
        mnemonic: info.mnemonic,
        operands: info.operands,
      });
      offset += consumed;
      i += consumed;
    } else {
      // Unknown opcode — display as DB (define byte)
      instructions.push({
        address: `0x${offset.toString(16).padStart(8, "0")}`,
        rawBytes: byte.toUpperCase(),
        mnemonic: "DB",
        operands: `0x${byte.toUpperCase()}`,
      });
      offset += 1;
      i += 1;
    }
  }

  return instructions;
}

const SAMPLE_HEX =
  "55 48 89 E5 48 83 EC 20 89 7D FC 8B 45 FC 83 C0 01 48 83 C4 20 5D C3";

export function Disassembler() {
  const [hexInput, setHexInput] = useState(SAMPLE_HEX);
  const [arch, setArch] = useState<Arch>("x64");
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const createSession = useCreateSession();

  const handleDisassemble = async () => {
    if (!hexInput.trim()) {
      toast.error("Enter hex bytes first");
      return;
    }
    setIsProcessing(true);
    try {
      const result = mockDisassemble(hexInput, arch);
      setInstructions(result);

      await createSession.mutateAsync({
        filename: `input.${arch}`,
        tool: "Disassembler",
        resultSummary: `${result.length} instructions decoded (${arch})`,
      });
      toast.success(`Disassembled ${result.length} instructions`);
    } catch {
      toast.error("Disassembly failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ disassembler
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Parse hex bytes into x86/x64 instruction listings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Input area */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                Hex Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                data-ocid="disasm.hex_input"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                placeholder="55 48 89 E5 48 83 EC 20..."
                className="font-mono text-xs bg-terminal-bg border-border text-terminal-green placeholder:text-muted-foreground/40 resize-none h-32"
                spellCheck={false}
              />
              <p className="font-mono text-xs text-muted-foreground">
                Space-separated hex bytes. Example:{" "}
                <span className="text-terminal-amber">55 48 89 E5 C3</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                Architecture
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs text-muted-foreground">
                  Target arch
                </Label>
                <Select value={arch} onValueChange={(v) => setArch(v as Arch)}>
                  <SelectTrigger
                    data-ocid="disasm.arch.select"
                    className="font-mono text-xs bg-terminal-bg border-border text-terminal-green"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-mono bg-card border-border">
                    <SelectItem value="x86" className="text-xs text-foreground">
                      x86 (32-bit)
                    </SelectItem>
                    <SelectItem value="x64" className="text-xs text-foreground">
                      x64 (64-bit)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                data-ocid="disasm.disassemble_button"
                onClick={handleDisassemble}
                disabled={isProcessing || !hexInput.trim()}
                className="w-full font-mono text-xs bg-terminal-green/10 border border-terminal-green/40 text-terminal-green hover:bg-terminal-green/20"
                variant="outline"
              >
                {isProcessing ? (
                  <>
                    <div className="w-3 h-3 border border-terminal-green border-t-transparent rounded-full animate-spin mr-2" />
                    Disassembling...
                  </>
                ) : (
                  <>
                    <Code2 className="w-3 h-3 mr-2" />
                    Disassemble
                  </>
                )}
              </Button>

              {instructions.length > 0 && (
                <div className="p-3 rounded border border-terminal-green/20 bg-terminal-green/5">
                  <p className="font-mono text-xs text-terminal-green">
                    {instructions.length} instructions
                  </p>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    Arch: {arch.toUpperCase()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Output */}
      {instructions.length > 0 && (
        <Card
          data-ocid="disasm.output.panel"
          className="border-border bg-card/60"
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-sm text-terminal-cyan">
                Disassembly Output
              </CardTitle>
              <Badge
                variant="outline"
                className="font-mono text-xs text-muted-foreground border-border"
              >
                {arch.toUpperCase()} · {instructions.length} instructions
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded border border-border bg-terminal-bg p-3 overflow-x-auto max-h-96 overflow-y-auto">
              <table className="hex-table w-full">
                <thead className="sticky top-0 bg-terminal-bg">
                  <tr className="border-b border-border">
                    <th className="text-left text-muted-foreground pr-6 pb-2 font-normal w-36">
                      Address
                    </th>
                    <th className="text-left text-muted-foreground pr-6 pb-2 font-normal w-32">
                      Bytes
                    </th>
                    <th className="text-left text-muted-foreground pr-4 pb-2 font-normal w-28">
                      Mnemonic
                    </th>
                    <th className="text-left text-muted-foreground pb-2 font-normal">
                      Operands
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {instructions.map((ins, i) => (
                    <tr
                      key={`${ins.address}-${i}`}
                      className="hover:bg-white/5"
                    >
                      <td className="text-terminal-amber pr-6 py-0.5">
                        {ins.address}
                      </td>
                      <td className="text-muted-foreground pr-6 py-0.5">
                        {ins.rawBytes}
                      </td>
                      <td
                        className={`pr-4 py-0.5 font-bold ${ins.mnemonic === "DB" ? "text-destructive" : "text-terminal-green"}`}
                      >
                        {ins.mnemonic}
                      </td>
                      <td className="text-terminal-cyan py-0.5">
                        {ins.operands}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
