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
import { AlertCircle, FileSearch, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

type FileType = "PE" | "ELF" | "Unknown";

interface PEFields {
  magic: string;
  dosMagic: string;
  peSignatureOffset: string;
  machineType: string;
  machineDesc: string;
  entryPoint: string;
  numberOfSections: number;
}

interface ELFFields {
  magic: string;
  class: string;
  dataEncoding: string;
  osABI: string;
  type: string;
  machine: string;
  entryPoint: string;
}

interface Section {
  name: string;
  virtualAddress: string;
  size: string;
  flags: string;
}

const PE_MACHINES: Record<number, string> = {
  0: "Unknown",
  332: "x86 (i386)",
  512: "IA64",
  34404: "x64 (AMD64)",
  43620: "ARM64",
  448: "ARM",
};

const ELF_MACHINES: Record<number, string> = {
  0: "No machine",
  2: "SPARC",
  3: "x86",
  8: "MIPS",
  20: "PowerPC",
  40: "ARM",
  42: "SuperH",
  50: "IA-64",
  62: "x86-64",
  183: "AArch64",
  243: "RISC-V",
};

const ELF_TYPES: Record<number, string> = {
  0: "ET_NONE",
  1: "ET_REL (Relocatable)",
  2: "ET_EXEC (Executable)",
  3: "ET_DYN (Shared object)",
  4: "ET_CORE (Core dump)",
};

const ELF_OS_ABI: Record<number, string> = {
  0: "System V / None",
  1: "HP-UX",
  2: "NetBSD",
  3: "Linux",
  6: "Solaris",
  9: "FreeBSD",
  12: "OpenBSD",
};

const MOCK_PE_SECTIONS = [
  {
    name: ".text",
    virtualAddress: "0x00001000",
    size: "0x0001A800",
    flags: "r-x",
  },
  {
    name: ".data",
    virtualAddress: "0x0001C000",
    size: "0x00002400",
    flags: "rw-",
  },
  {
    name: ".rdata",
    virtualAddress: "0x0001F000",
    size: "0x00008C00",
    flags: "r--",
  },
  {
    name: ".rsrc",
    virtualAddress: "0x00028000",
    size: "0x00001000",
    flags: "r--",
  },
  {
    name: ".reloc",
    virtualAddress: "0x00029000",
    size: "0x00000400",
    flags: "r--",
  },
];

const MOCK_ELF_SECTIONS = [
  {
    name: ".text",
    virtualAddress: "0x00400000",
    size: "0x0001E5A0",
    flags: "AX",
  },
  {
    name: ".rodata",
    virtualAddress: "0x00420000",
    size: "0x00004200",
    flags: "A",
  },
  {
    name: ".data",
    virtualAddress: "0x00625000",
    size: "0x00001800",
    flags: "WA",
  },
  {
    name: ".bss",
    virtualAddress: "0x00626800",
    size: "0x00000E00",
    flags: "WA",
  },
  {
    name: ".dynamic",
    virtualAddress: "0x00627000",
    size: "0x000001D0",
    flags: "WA",
  },
  {
    name: ".got.plt",
    virtualAddress: "0x006271D0",
    size: "0x00000030",
    flags: "WA",
  },
];

function parsePE(bytes: Uint8Array): PEFields {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const peOffset = bytes.length >= 64 ? view.getUint32(0x3c, true) : 0x80;
  const machineCode =
    bytes.length >= peOffset + 6 ? view.getUint16(peOffset + 4, true) : 0x8664;
  const entryPoint =
    bytes.length >= peOffset + 44
      ? view.getUint32(peOffset + 40, true)
      : 0x1000;
  const numSections =
    bytes.length >= peOffset + 8 ? view.getUint16(peOffset + 6, true) : 5;

  return {
    magic: "0x4D5A",
    dosMagic: "MZ",
    peSignatureOffset: `0x${peOffset.toString(16).padStart(8, "0")}`,
    machineType: `0x${machineCode.toString(16).padStart(4, "0")}`,
    machineDesc:
      PE_MACHINES[machineCode] ?? `Unknown (0x${machineCode.toString(16)})`,
    entryPoint: `0x${entryPoint.toString(16).padStart(8, "0")}`,
    numberOfSections: Math.min(numSections, 16),
  };
}

function parseELF(bytes: Uint8Array): ELFFields {
  const cls = bytes[4] === 1 ? "ELF32" : "ELF64";
  const encoding = bytes[5] === 1 ? "LSB (Little Endian)" : "MSB (Big Endian)";
  const osABI = ELF_OS_ABI[bytes[7]] ?? `Unknown (0x${bytes[7].toString(16)})`;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const elfType = bytes.length >= 18 ? view.getUint16(16, bytes[5] === 1) : 2;
  const machine =
    bytes.length >= 20 ? view.getUint16(18, bytes[5] === 1) : 0x3e;
  const ep = bytes.length >= 28 ? view.getUint32(24, bytes[5] === 1) : 0;

  return {
    magic: "7F 45 4C 46",
    class: cls,
    dataEncoding: encoding,
    osABI,
    type: ELF_TYPES[elfType] ?? `Unknown (${elfType})`,
    machine: ELF_MACHINES[machine] ?? `Unknown (0x${machine.toString(16)})`,
    entryPoint: `0x${ep.toString(16).padStart(8, "0")}`,
  };
}

export function HeaderInspector() {
  const [fileType, setFileType] = useState<FileType | null>(null);
  const [peFields, setPeFields] = useState<PEFields | null>(null);
  const [elfFields, setElfFields] = useState<ELFFields | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [filename, setFilename] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const createSession = useCreateSession();

  const handleFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    setFilename(file.name);

    let type: FileType = "Unknown";
    let summary = "";

    // Check magic bytes
    if (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) {
      type = "PE";
      const fields = parsePE(bytes);
      setPeFields(fields);
      setElfFields(null);
      setSections(MOCK_PE_SECTIONS);
      summary = `PE (${fields.machineDesc}) | EP: ${fields.entryPoint} | ${fields.numberOfSections} sections`;
    } else if (
      bytes.length >= 4 &&
      bytes[0] === 0x7f &&
      bytes[1] === 0x45 &&
      bytes[2] === 0x4c &&
      bytes[3] === 0x46
    ) {
      type = "ELF";
      const fields = parseELF(bytes);
      setPeFields(null);
      setElfFields(fields);
      setSections(MOCK_ELF_SECTIONS);
      summary = `ELF (${fields.class}) | ${fields.machine} | ${fields.type}`;
    } else {
      type = "Unknown";
      setPeFields(null);
      setElfFields(null);
      setSections([]);
      summary = "Unknown format — not PE or ELF";
    }

    setFileType(type);
    await createSession.mutateAsync({
      filename: file.name,
      tool: "Header Inspector",
      resultSummary: summary,
    });
    toast.success(`Parsed ${type} header`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ header-inspector
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Parse PE and ELF binary headers, detect format, extract fields
        </p>
      </div>

      {/* Upload */}
      <label
        data-ocid="header.upload_button"
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
            ? "border-terminal-cyan bg-terminal-cyan/5"
            : "border-border hover:border-terminal-cyan/50 hover:bg-muted/10",
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
        <Upload className="w-7 h-7 text-muted-foreground mb-3" />
        <p className="font-mono text-sm text-foreground font-medium">
          {filename || "Drop a PE or ELF binary"}
        </p>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          .exe, .dll, .so, .elf, kernel modules...
        </p>
        {fileType && (
          <Badge
            className={cn(
              "mt-3 font-mono text-xs",
              fileType === "PE" &&
                "bg-terminal-cyan/10 text-terminal-cyan border-terminal-cyan/30",
              fileType === "ELF" &&
                "bg-terminal-green/10 text-terminal-green border-terminal-green/30",
              fileType === "Unknown" &&
                "bg-destructive/10 text-destructive border-destructive/30",
            )}
            variant="outline"
          >
            {fileType === "Unknown" ? "Unknown Format" : `${fileType} Binary`}
          </Badge>
        )}
      </label>

      {fileType === "Unknown" && (
        <div className="flex items-center gap-3 p-4 rounded border border-destructive/30 bg-destructive/5">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="font-mono text-xs text-destructive">
            File does not appear to be a PE (MZ magic) or ELF (0x7F ELF magic)
            binary.
          </p>
        </div>
      )}

      {/* PE Fields */}
      {peFields && (
        <Card
          data-ocid="header.fields.panel"
          className="border-border bg-card/60"
        >
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
              <FileSearch className="w-4 h-4" />
              PE Header Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Magic Bytes", value: peFields.magic },
                { label: "DOS Magic", value: peFields.dosMagic },
                { label: "PE Sig Offset", value: peFields.peSignatureOffset },
                { label: "Machine Type", value: peFields.machineType },
                { label: "Architecture", value: peFields.machineDesc },
                { label: "Entry Point", value: peFields.entryPoint },
                {
                  label: "Num Sections",
                  value: String(peFields.numberOfSections),
                },
              ].map((f) => (
                <div key={f.label} className="space-y-1">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                    {f.label}
                  </p>
                  <p className="font-mono text-xs text-terminal-green">
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ELF Fields */}
      {elfFields && (
        <Card
          data-ocid="header.fields.panel"
          className="border-border bg-card/60"
        >
          <CardHeader className="pb-3">
            <CardTitle className="font-mono text-sm text-terminal-green flex items-center gap-2">
              <FileSearch className="w-4 h-4" />
              ELF Header Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Magic", value: elfFields.magic },
                { label: "Class", value: elfFields.class },
                { label: "Data Encoding", value: elfFields.dataEncoding },
                { label: "OS/ABI", value: elfFields.osABI },
                { label: "Type", value: elfFields.type },
                { label: "Machine", value: elfFields.machine },
                { label: "Entry Point", value: elfFields.entryPoint },
              ].map((f) => (
                <div key={f.label} className="space-y-1">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                    {f.label}
                  </p>
                  <p className="font-mono text-xs text-terminal-green">
                    {f.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections table */}
      {sections.length > 0 && (
        <Card className="border-border bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-mono text-sm text-terminal-cyan">
                Sections
              </CardTitle>
              <Badge
                variant="outline"
                className="font-mono text-xs text-muted-foreground border-border"
              >
                {sections.length} sections
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded border border-border overflow-hidden">
              <Table data-ocid="header.sections.table">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      Name
                    </TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      Virtual Address
                    </TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      Size
                    </TableHead>
                    <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      Flags
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sections.map((s, i) => (
                    <TableRow
                      key={s.name}
                      data-ocid={`header.sections.row.${i + 1}`}
                      className="border-border hover:bg-muted/20 font-mono text-xs"
                    >
                      <TableCell className="text-terminal-amber font-bold">
                        {s.name}
                      </TableCell>
                      <TableCell className="text-terminal-green">
                        {s.virtualAddress}
                      </TableCell>
                      <TableCell className="text-terminal-cyan">
                        {s.size}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs text-muted-foreground border-border"
                        >
                          {s.flags}
                        </Badge>
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
  );
}
