import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { AlertCircle, Code2, Cpu, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Arch = "x86" | "x64" | "arm" | "arm64";

interface Instruction {
  address: string;
  rawBytes: string;
  mnemonic: string;
  operands: string;
}

// x86/x64 instruction table
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

// ARM 32-bit: 4-byte little-endian opcodes (hex of 4 bytes joined)
const ARM_INSTRUCTIONS: Record<string, { mnemonic: string; operands: string }> =
  {
    e12fff1e: { mnemonic: "BX", operands: "LR" },
    e8bd8000: { mnemonic: "POP", operands: "{PC}" },
    e92d4000: { mnemonic: "PUSH", operands: "{LR}" },
    e3a00000: { mnemonic: "MOV", operands: "R0, #0" },
    e5901000: { mnemonic: "LDR", operands: "R1, [R0]" },
    ea000000: { mnemonic: "B", operands: "rel24" },
    e0800001: { mnemonic: "ADD", operands: "R0, R0, R1" },
    e0400001: { mnemonic: "SUB", operands: "R0, R0, R1" },
    e1a00000: { mnemonic: "MOV", operands: "R0, R0 (NOP)" },
    e58d0000: { mnemonic: "STR", operands: "R0, [SP]" },
    e59d0000: { mnemonic: "LDR", operands: "R0, [SP]" },
    e28dd000: { mnemonic: "ADD", operands: "SP, SP, #0" },
  };

// ARM64: 4-byte little-endian opcodes
const ARM64_INSTRUCTIONS: Record<
  string,
  { mnemonic: string; operands: string }
> = {
  d65f03c0: { mnemonic: "RET", operands: "" },
  d503201f: { mnemonic: "NOP", operands: "" },
  a9bf7bfd: { mnemonic: "STP", operands: "X29, X30, [SP, #-16]!" },
  a8c17bfd: { mnemonic: "LDP", operands: "X29, X30, [SP], #16" },
  "910003fd": { mnemonic: "MOV", operands: "X29, SP" },
  d2800000: { mnemonic: "MOV", operands: "X0, #0" },
  b9000000: { mnemonic: "STR", operands: "W0, [X0]" },
  b9400000: { mnemonic: "LDR", operands: "W0, [X0]" },
  "8b000000": { mnemonic: "ADD", operands: "X0, X0, X0" },
  cb000000: { mnemonic: "SUB", operands: "X0, X0, X0" },
  "14000000": { mnemonic: "B", operands: "rel26" },
  "94000000": { mnemonic: "BL", operands: "rel26" },
};

function parseHexTokens(hexInput: string): string[] {
  return hexInput
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-f\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

function mockDisassembleX86(tokens: string[], baseAddr: number): Instruction[] {
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
        address: `0x${(baseAddr + offset).toString(16).padStart(8, "0")}`,
        rawBytes,
        mnemonic: info.mnemonic,
        operands: info.operands,
      });
      offset += consumed;
      i += consumed;
    } else {
      instructions.push({
        address: `0x${(baseAddr + offset).toString(16).padStart(8, "0")}`,
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

function mockDisassembleARM(
  tokens: string[],
  baseAddr: number,
  arch: "arm" | "arm64",
): Instruction[] {
  const table = arch === "arm" ? ARM_INSTRUCTIONS : ARM64_INSTRUCTIONS;
  const instructions: Instruction[] = [];
  let offset = 0;
  let i = 0;

  while (i + 3 < tokens.length && instructions.length < 128) {
    // ARM: little-endian 4-byte word
    const word = [tokens[i + 3], tokens[i + 2], tokens[i + 1], tokens[i]].join(
      "",
    );
    const info = table[word];
    const rawBytes = tokens
      .slice(i, i + 4)
      .join(" ")
      .toUpperCase();
    if (info) {
      instructions.push({
        address: `0x${(baseAddr + offset).toString(16).padStart(8, "0")}`,
        rawBytes,
        mnemonic: info.mnemonic,
        operands: info.operands,
      });
    } else {
      instructions.push({
        address: `0x${(baseAddr + offset).toString(16).padStart(8, "0")}`,
        rawBytes,
        mnemonic: "DCW",
        operands: `0x${word.toUpperCase()}`,
      });
    }
    offset += 4;
    i += 4;
  }
  return instructions;
}

function mockDisassemble(
  hexInput: string,
  arch: Arch,
  baseAddr: number,
): Instruction[] {
  const tokens = parseHexTokens(hexInput);
  if (arch === "arm" || arch === "arm64") {
    return mockDisassembleARM(tokens, baseAddr, arch);
  }
  return mockDisassembleX86(tokens, baseAddr);
}

const SAMPLE_HEX =
  "55 48 89 E5 48 83 EC 20 89 7D FC 8B 45 FC 83 C0 01 48 83 C4 20 5D C3";

const SAMPLE_ARM =
  "00 40 2D E9 00 00 A0 E3 00 10 91 E5 00 00 80 E0 1E FF 2F E1";

export function Disassembler() {
  const [hexInput, setHexInput] = useState(SAMPLE_HEX);
  const [arch, setArch] = useState<Arch>("x64");
  const [baseAddrStr, setBaseAddrStr] = useState("0x00400000");
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const createSession = useCreateSession();

  const parseBase = () => {
    const v = Number.parseInt(baseAddrStr.replace(/^0x/i, ""), 16);
    return Number.isNaN(v) ? 0x00400000 : v;
  };

  const handleArchChange = (v: string) => {
    const a = v as Arch;
    setArch(a);
    if (a === "arm" || a === "arm64") {
      setHexInput(SAMPLE_ARM);
    } else {
      setHexInput(SAMPLE_HEX);
    }
    setInstructions([]);
  };

  const handleDisassemble = async () => {
    if (!hexInput.trim()) {
      toast.error("Enter hex bytes first");
      return;
    }
    setIsProcessing(true);
    try {
      const base = parseBase();
      const result = mockDisassemble(hexInput, arch, base);
      setInstructions(result);

      await createSession.mutateAsync({
        filename: `input.${arch}`,
        tool: "Disassembler",
        resultSummary: `${result.length} instructions decoded (${arch.toUpperCase()}) @ base 0x${base.toString(16)}`,
      });
      toast.success(`Disassembled ${result.length} instructions`);
    } catch {
      toast.error("Disassembly failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = (format: "json" | "csv") => {
    if (!instructions.length) return;
    if (format === "json") {
      const data = { arch, base: baseAddrStr, instructions };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `disasm.${arch}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const rows = ["Address,Bytes,Mnemonic,Operands"];
      for (const ins of instructions) {
        rows.push(
          `${ins.address},"${ins.rawBytes}",${ins.mnemonic},"${ins.operands}"`,
        );
      }
      const blob = new Blob([rows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `disasm.${arch}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ disassembler
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Parse hex bytes into x86/x64/ARM/ARM64 instruction listings
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
                <Select value={arch} onValueChange={handleArchChange}>
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
                    <SelectItem value="arm" className="text-xs text-foreground">
                      ARM (32-bit)
                    </SelectItem>
                    <SelectItem
                      value="arm64"
                      className="text-xs text-foreground"
                    >
                      ARM64 (AArch64)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-xs text-muted-foreground">
                  Base address
                </Label>
                <Input
                  data-ocid="disasm.base_addr.input"
                  value={baseAddrStr}
                  onChange={(e) => setBaseAddrStr(e.target.value)}
                  placeholder="0x00400000"
                  className="font-mono text-xs bg-terminal-bg border-border text-terminal-amber h-8"
                  spellCheck={false}
                />
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
                <div className="p-3 rounded border border-terminal-green/20 bg-terminal-green/5 space-y-2">
                  <p className="font-mono text-xs text-terminal-green">
                    {instructions.length} instructions
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Arch: {arch.toUpperCase()} @ {baseAddrStr}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      data-ocid="disasm.export_json.button"
                      onClick={() => handleExport("json")}
                      className="flex-1 font-mono text-xs border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 gap-1 h-7"
                    >
                      <Download className="w-3 h-3" />
                      JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      data-ocid="disasm.export_csv.button"
                      onClick={() => handleExport("csv")}
                      className="flex-1 font-mono text-xs border-terminal-amber/40 text-terminal-amber hover:bg-terminal-amber/10 gap-1 h-7"
                    >
                      <Download className="w-3 h-3" />
                      CSV
                    </Button>
                  </div>
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
                    <th className="text-left text-muted-foreground pr-6 pb-2 font-normal w-40">
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
                        className={`pr-4 py-0.5 font-bold ${ins.mnemonic === "DB" || ins.mnemonic === "DCW" ? "text-destructive" : "text-terminal-green"}`}
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
            {arch === "arm" || arch === "arm64" ? (
              <p className="font-mono text-xs text-muted-foreground mt-2 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" />
                ARM mode: bytes decoded as 4-byte little-endian words
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
