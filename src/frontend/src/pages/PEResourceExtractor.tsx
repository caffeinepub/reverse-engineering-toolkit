import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Package,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const RESOURCE_TYPES: Record<number, string> = {
  1: "RT_CURSOR",
  2: "RT_BITMAP",
  3: "RT_ICON",
  4: "RT_MENU",
  5: "RT_DIALOG",
  6: "RT_STRING",
  9: "RT_ACCELERATOR",
  10: "RT_RCDATA",
  11: "RT_MESSAGETABLE",
  14: "RT_GROUP_ICON",
  16: "RT_VERSION",
  24: "RT_MANIFEST",
};

interface ResourceLeaf {
  offset: number;
  size: number;
  langId: number;
}

interface ResourceName {
  name: string;
  isNamed: boolean;
  leaves: ResourceLeaf[];
}

interface ResourceType {
  typeId: number;
  typeName: string;
  names: ResourceName[];
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

function rvaToFO(bytes: Uint8Array, rva: number, ntOffset: number): number {
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
  return rva;
}

function parseResources(bytes: Uint8Array): ResourceType[] | null {
  try {
    if (bytes.length < 0x40) return null;
    if (bytes[0] !== 0x4d || bytes[1] !== 0x5a) return null;

    const peOffset = readU32LE(bytes, 0x3c);
    if (peOffset + 4 > bytes.length) return null;
    if (
      bytes[peOffset] !== 0x50 ||
      bytes[peOffset + 1] !== 0x45 ||
      bytes[peOffset + 2] !== 0 ||
      bytes[peOffset + 3] !== 0
    )
      return null;

    const magic = readU16LE(bytes, peOffset + 24);
    const is64 = magic === 0x20b;
    const resDirOffset = is64 ? peOffset + 24 + 120 : peOffset + 24 + 112;
    if (resDirOffset + 8 > bytes.length) return null;

    const resRVA = readU32LE(bytes, resDirOffset);
    if (resRVA === 0) return null;

    const resFO = rvaToFO(bytes, resRVA, peOffset);
    if (resFO >= bytes.length) return null;

    const types: ResourceType[] = [];

    // Level 1: Type entries
    const numNamedTypes = readU16LE(bytes, resFO + 12);
    const numIdTypes = readU16LE(bytes, resFO + 14);
    const totalTypes = numNamedTypes + numIdTypes;

    for (let t = 0; t < Math.min(totalTypes, 64); t++) {
      const entryOffset = resFO + 16 + t * 8;
      if (entryOffset + 8 > bytes.length) break;
      const typeId = readU32LE(bytes, entryOffset);
      const typeOffset = readU32LE(bytes, entryOffset + 4);

      const isSubDir = (typeOffset & 0x80000000) !== 0;
      if (!isSubDir) continue;
      const subDirFO = resFO + (typeOffset & 0x7fffffff);

      const isNamed = (typeId & 0x80000000) !== 0;
      let typeName: string;
      if (isNamed) {
        const nameOffset = resFO + (typeId & 0x7fffffff);
        const nameLen = readU16LE(bytes, nameOffset);
        const nameBytes: number[] = [];
        for (
          let i = 0;
          i < nameLen && nameOffset + 2 + i * 2 < bytes.length;
          i++
        ) {
          nameBytes.push(readU16LE(bytes, nameOffset + 2 + i * 2));
        }
        typeName = nameBytes.map((c) => String.fromCharCode(c)).join("");
      } else {
        typeName = RESOURCE_TYPES[typeId] ?? `RT_UNKNOWN(${typeId})`;
      }

      // Level 2: Name entries
      if (subDirFO + 16 > bytes.length) continue;
      const numNamedNames = readU16LE(bytes, subDirFO + 12);
      const numIdNames = readU16LE(bytes, subDirFO + 14);
      const totalNames = numNamedNames + numIdNames;
      const names: ResourceName[] = [];

      for (let n = 0; n < Math.min(totalNames, 64); n++) {
        const nameEntryOffset = subDirFO + 16 + n * 8;
        if (nameEntryOffset + 8 > bytes.length) break;
        const nameId = readU32LE(bytes, nameEntryOffset);
        const nameOffsetRaw = readU32LE(bytes, nameEntryOffset + 4);

        const isNamedEntry = (nameId & 0x80000000) !== 0;
        let resName: string;
        if (isNamedEntry) {
          const strOffset = resFO + (nameId & 0x7fffffff);
          const strLen = readU16LE(bytes, strOffset);
          const chars: number[] = [];
          for (let i = 0; i < strLen; i++) {
            chars.push(readU16LE(bytes, strOffset + 2 + i * 2));
          }
          resName = chars.map((c) => String.fromCharCode(c)).join("");
        } else {
          resName = `ID: ${nameId}`;
        }

        const isSubDir2 = (nameOffsetRaw & 0x80000000) !== 0;
        if (!isSubDir2) continue;
        const langDirFO = resFO + (nameOffsetRaw & 0x7fffffff);
        if (langDirFO + 16 > bytes.length) continue;

        // Level 3: Language entries
        const numLangs =
          readU16LE(bytes, langDirFO + 12) + readU16LE(bytes, langDirFO + 14);
        const leaves: ResourceLeaf[] = [];

        for (let l = 0; l < Math.min(numLangs, 32); l++) {
          const langEntryOffset = langDirFO + 16 + l * 8;
          if (langEntryOffset + 8 > bytes.length) break;
          const langId = readU32LE(bytes, langEntryOffset) & 0x7fffffff;
          const dataEntryRaw = readU32LE(bytes, langEntryOffset + 4);

          const isLeaf = (dataEntryRaw & 0x80000000) === 0;
          if (!isLeaf) continue;
          const dataEntryFO = resFO + dataEntryRaw;
          if (dataEntryFO + 16 > bytes.length) continue;

          const dataRVA = readU32LE(bytes, dataEntryFO);
          const dataSize = readU32LE(bytes, dataEntryFO + 4);
          const dataFO = rvaToFO(bytes, dataRVA, peOffset);

          leaves.push({ offset: dataFO, size: dataSize, langId });
        }

        if (leaves.length > 0) {
          names.push({ name: resName, isNamed: isNamedEntry, leaves });
        }
      }

      if (names.length > 0) {
        types.push({
          typeId: typeId & 0x7fffffff,
          typeName,
          names,
        });
      }
    }

    return types.length > 0 ? types : null;
  } catch {
    return null;
  }
}

interface ResourceTreeNodeProps {
  type: ResourceType;
  fileBytes: Uint8Array;
  filename: string;
}

function ResourceTreeNode({
  type,
  fileBytes,
  filename,
}: ResourceTreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const totalLeaves = type.names.reduce((acc, n) => acc + n.leaves.length, 0);

  const toggleName = (name: string) => {
    setExpandedNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleExtract = (leaf: ResourceLeaf, name: string) => {
    if (leaf.offset + leaf.size > fileBytes.length) {
      toast.error("Resource data out of bounds");
      return;
    }
    const data = fileBytes.slice(leaf.offset, leaf.offset + leaf.size);
    const blob = new Blob([data], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${type.typeName}_${name}_lang${leaf.langId}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Extracted ${leaf.size} bytes`);
  };

  return (
    <div className="border border-border/60 rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-terminal-bg/50 hover:bg-terminal-bg transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-terminal-amber shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-terminal-amber shrink-0" />
        )}
        <span className="font-mono text-xs text-terminal-amber font-semibold">
          {type.typeName}
        </span>
        <Badge
          variant="outline"
          className="ml-auto font-mono text-xs border-border text-muted-foreground"
        >
          {totalLeaves}
        </Badge>
      </button>

      {expanded && (
        <div className="divide-y divide-border/40">
          {type.names.map((nameEntry) => (
            <div key={nameEntry.name} className="pl-4">
              <button
                type="button"
                onClick={() => toggleName(nameEntry.name)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-terminal-bg/30 transition-colors"
              >
                {expandedNames.has(nameEntry.name) ? (
                  <ChevronDown className="w-3 h-3 text-terminal-cyan shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-terminal-cyan shrink-0" />
                )}
                <span className="font-mono text-xs text-terminal-cyan">
                  {nameEntry.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground ml-auto">
                  {nameEntry.leaves.length} lang
                  {nameEntry.leaves.length !== 1 ? "s" : ""}
                </span>
              </button>

              {expandedNames.has(nameEntry.name) && (
                <div className="pl-6 pb-2 space-y-1">
                  {nameEntry.leaves.map((leaf) => (
                    <div
                      key={`${leaf.offset}-${leaf.langId}`}
                      className="flex items-center gap-2 py-1 px-2 rounded hover:bg-terminal-bg/20"
                    >
                      <span className="font-mono text-xs text-muted-foreground flex-1">
                        Lang: 0x{leaf.langId.toString(16).padStart(4, "0")} •
                        Offset: 0x{leaf.offset.toString(16)} • Size:{" "}
                        {leaf.size.toLocaleString()} B
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        data-ocid="resources.extract.button"
                        onClick={() => handleExtract(leaf, nameEntry.name)}
                        className="h-6 font-mono text-xs border-terminal-green/40 text-terminal-green hover:bg-terminal-green/10 gap-1"
                      >
                        <Download className="w-2.5 h-2.5" />
                        Extract
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PEResourceExtractor() {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resources, setResources] = useState<ResourceType[] | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [filename, setFilename] = useState("");
  const createSession = useCreateSession();

  const analyzeFile = async (file: File) => {
    setIsLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const parsed = parseResources(bytes);
      setFileBytes(bytes);
      setFilename(file.name);
      setResources(parsed ?? []);

      const totalEntries =
        parsed?.reduce(
          (acc, t) => acc + t.names.reduce((a, n) => a + n.leaves.length, 0),
          0,
        ) ?? 0;

      await createSession.mutateAsync({
        filename: file.name,
        tool: "PE Resource Extractor",
        resultSummary: parsed
          ? `${parsed.length} resource types, ${totalEntries} entries`
          : "No PE resource directory found",
      });
      toast.success(parsed ? "Resources parsed" : "No PE resources found");
    } catch {
      toast.error("Failed to parse PE");
    } finally {
      setIsLoading(false);
    }
  };

  const totalEntries =
    resources?.reduce(
      (acc, t) => acc + t.names.reduce((a, n) => a + n.leaves.length, 0),
      0,
    ) ?? 0;

  const totalSize =
    resources && fileBytes
      ? resources.reduce(
          (acc, t) =>
            acc +
            t.names.reduce(
              (a, n) =>
                a +
                n.leaves.reduce(
                  (la, l) => la + Math.min(l.size, fileBytes.length - l.offset),
                  0,
                ),
              0,
            ),
          0,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ pe-resource-extractor
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Browse and extract PE resource directory entries
        </p>
      </div>

      {!resources && (
        <label
          data-ocid="resources.upload_button"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) analyzeFile(file);
          }}
          className={cn(
            "relative border-2 border-dashed rounded p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
            isDragging
              ? "border-terminal-green bg-terminal-green/5"
              : "border-border hover:border-terminal-green/50 hover:bg-muted/20",
          )}
        >
          <input
            type="file"
            className="hidden"
            accept=".exe,.dll,.sys,.ocx,.bin"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) analyzeFile(f);
            }}
          />
          <Package className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="font-mono text-sm text-foreground font-medium">
            Drop PE file (.exe, .dll)
          </p>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Extracts RT_ICON, RT_MANIFEST, RT_VERSION, RT_STRING, and more
          </p>
        </label>
      )}

      {isLoading && (
        <div
          data-ocid="resources.loading_state"
          className="flex items-center gap-3 p-4 rounded border border-terminal-green/30 bg-terminal-green/5"
        >
          <div className="w-4 h-4 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-terminal-green">
            Parsing resource directory...
          </span>
        </div>
      )}

      {resources !== null && !isLoading && (
        <div className="space-y-4">
          {/* Stats */}
          <Card
            data-ocid="resources.stats.panel"
            className="border-border bg-card/60"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {filename}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setResources(null);
                    setFileBytes(null);
                    setFilename("");
                  }}
                  className="font-mono text-xs border-border text-muted-foreground h-7"
                >
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-terminal-green/40 text-terminal-green"
                >
                  {resources.length} resource types
                </Badge>
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan"
                >
                  {totalEntries} total entries
                </Badge>
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-terminal-amber/40 text-terminal-amber"
                >
                  {totalSize.toLocaleString()} bytes total
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Tree */}
          {resources.length === 0 ? (
            <div
              data-ocid="resources.empty_state"
              className="text-center py-12 rounded border border-border"
            >
              <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-mono text-sm text-muted-foreground mb-1">
                No PE resource directory found
              </p>
              <p className="font-mono text-xs text-muted-foreground/60">
                File may not be a valid PE or may have no resources
              </p>
            </div>
          ) : (
            <div data-ocid="resources.tree.panel" className="space-y-2">
              <h2 className="font-mono text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                Resource Tree
              </h2>
              {resources.map((type) => (
                <ResourceTreeNode
                  key={`${type.typeId}-${type.typeName}`}
                  type={type}
                  fileBytes={fileBytes!}
                  filename={filename.replace(/\.[^.]+$/, "")}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
