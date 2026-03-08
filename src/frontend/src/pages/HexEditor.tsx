import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Copy, Download, Edit3, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const BYTES_PER_ROW = 16;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.replace(/\s/g, "");
  if (clean.length % 2 !== 0) return null;
  try {
    const arr = new Uint8Array(clean.length / 2);
    for (let i = 0; i < clean.length; i += 2) {
      const byte = Number.parseInt(clean.slice(i, i + 2), 16);
      if (Number.isNaN(byte)) return null;
      arr[i / 2] = byte;
    }
    return arr;
  } catch {
    return null;
  }
}

export function HexEditor() {
  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [modifiedBytes, setModifiedBytes] = useState<Uint8Array | null>(null);
  const [filename, setFilename] = useState("paste.bin");
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [pasteInput, setPasteInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const createSession = useCreateSession();

  const changedOffsets = new Set<number>();
  if (originalBytes && modifiedBytes) {
    for (
      let i = 0;
      i < Math.min(originalBytes.length, modifiedBytes.length);
      i++
    ) {
      if (originalBytes[i] !== modifiedBytes[i]) changedOffsets.add(i);
    }
  }

  const loadBytes = useCallback((bytes: Uint8Array, name: string) => {
    setOriginalBytes(bytes);
    setModifiedBytes(new Uint8Array(bytes));
    setFilename(name);
    setSelectedOffset(null);
    setEditValue("");
  }, []);

  const handleFile = async (file: File) => {
    setIsLoading(true);
    try {
      const buf = await file.arrayBuffer();
      loadBytes(new Uint8Array(buf), file.name);
    } catch {
      toast.error("Failed to read file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handlePasteLoad = () => {
    const bytes = hexToBytes(pasteInput);
    if (!bytes) {
      toast.error("Invalid hex string");
      return;
    }
    loadBytes(bytes, "paste.bin");
    toast.success(`Loaded ${bytes.length} bytes`);
  };

  const handleByteClick = (offset: number) => {
    setSelectedOffset(offset);
    setEditValue(
      modifiedBytes
        ? modifiedBytes[offset].toString(16).padStart(2, "0")
        : "00",
    );
  };

  const handleByteEdit = () => {
    if (selectedOffset === null || !modifiedBytes) return;
    const val = Number.parseInt(editValue, 16);
    if (Number.isNaN(val) || val < 0 || val > 255) {
      toast.error("Value must be 00–FF");
      return;
    }
    const newBytes = new Uint8Array(modifiedBytes);
    newBytes[selectedOffset] = val;
    setModifiedBytes(newBytes);
  };

  const handleCopyHex = () => {
    if (!modifiedBytes) return;
    navigator.clipboard.writeText(bytesToHex(modifiedBytes));
    toast.success("Copied hex to clipboard");
  };

  const handleExportBinary = async () => {
    if (!modifiedBytes) return;
    const blob = new Blob([modifiedBytes.buffer as ArrayBuffer], {
      type: "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modified_${filename}`;
    a.click();
    URL.revokeObjectURL(url);

    try {
      await createSession.mutateAsync({
        filename,
        tool: "Hex Editor",
        resultSummary: `${changedOffsets.size} byte${changedOffsets.size !== 1 ? "s" : ""} modified`,
      });
      toast.success("Exported. Session saved.");
    } catch {
      toast.success("Exported binary");
    }
  };

  const renderHexGrid = (bytes: Uint8Array, isOriginal = false) => {
    const rows: React.ReactNode[] = [];
    const totalRows = Math.ceil(bytes.length / BYTES_PER_ROW);

    for (let row = 0; row < totalRows; row++) {
      const offset = row * BYTES_PER_ROW;
      const rowBytes = bytes.slice(offset, offset + BYTES_PER_ROW);
      const isChangedRow = Array.from(rowBytes).some((_, i) =>
        changedOffsets.has(offset + i),
      );

      rows.push(
        <tr
          key={offset}
          className={cn(
            "hover:bg-white/5 transition-colors",
            isChangedRow && !isOriginal && "bg-terminal-amber/5",
          )}
        >
          {/* Address */}
          <td className="text-terminal-amber pr-3 py-0.5 select-none font-mono text-xs whitespace-nowrap">
            {offset.toString(16).padStart(8, "0")}
          </td>
          {/* Hex bytes */}
          <td className="pr-3 py-0.5">
            <span className="flex gap-1">
              {Array.from({ length: BYTES_PER_ROW }, (_, col) => {
                const byteOffset = offset + col;
                const byte = col < rowBytes.length ? rowBytes[col] : null;
                const isSelected = !isOriginal && selectedOffset === byteOffset;
                const isChanged = changedOffsets.has(byteOffset);
                return (
                  <button
                    type="button"
                    key={byteOffset}
                    disabled={byte === null || isOriginal}
                    onClick={() =>
                      !isOriginal &&
                      byte !== null &&
                      handleByteClick(byteOffset)
                    }
                    className={cn(
                      "inline-block w-[18px] font-mono text-xs transition-colors bg-transparent border-0 p-0",
                      col === 8 && "ml-2",
                      byte === null
                        ? "opacity-0"
                        : isSelected
                          ? "text-terminal-bg bg-terminal-amber rounded cursor-pointer"
                          : isChanged && !isOriginal
                            ? "text-terminal-amber cursor-pointer"
                            : byte === 0
                              ? "text-muted-foreground/40 cursor-pointer hover:text-terminal-green"
                              : "text-terminal-green cursor-pointer hover:text-terminal-cyan",
                    )}
                  >
                    {byte !== null ? byte.toString(16).padStart(2, "0") : "  "}
                  </button>
                );
              })}
            </span>
          </td>
          {/* ASCII */}
          <td className="py-0.5 font-mono text-xs text-terminal-cyan">
            {Array.from(rowBytes)
              .map((b) =>
                b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".",
              )
              .join("")}
          </td>
        </tr>,
      );
    }
    return rows;
  };

  const hasData = !!modifiedBytes;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ hex-editor
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Interactive byte-level binary editor with diff view
        </p>
      </div>

      {/* Input area */}
      {!hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* File upload */}
          <label
            data-ocid="hexeditor.upload_button"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "relative border-2 border-dashed rounded p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
              isDragging
                ? "border-terminal-green bg-terminal-green/5"
                : "border-border hover:border-terminal-green/50 hover:bg-muted/20",
            )}
          >
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Upload className="w-8 h-8 text-muted-foreground mb-3" />
            <p className="font-mono text-sm text-foreground font-medium">
              Drop binary file
            </p>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              or click to select
            </p>
          </label>

          {/* Paste hex */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-sm text-terminal-cyan">
                Paste Hex
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                data-ocid="hexeditor.paste.textarea"
                value={pasteInput}
                onChange={(e) => setPasteInput(e.target.value)}
                placeholder="4D 5A 90 00 03 00 00 00..."
                className="font-mono text-xs bg-terminal-bg border-border text-terminal-green placeholder:text-muted-foreground/40 resize-none h-24"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handlePasteLoad}
                className="font-mono text-xs border-terminal-green/40 text-terminal-green hover:bg-terminal-green/10 w-full"
              >
                Load Hex
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading && (
        <div
          data-ocid="hexeditor.loading_state"
          className="flex items-center gap-3 p-4 rounded border border-terminal-green/30 bg-terminal-green/5"
        >
          <div className="w-4 h-4 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-terminal-green">
            Loading binary...
          </span>
        </div>
      )}

      {hasData && modifiedBytes && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              variant="outline"
              className="font-mono text-xs border-border text-muted-foreground"
            >
              {filename}
            </Badge>
            <Badge
              variant="outline"
              className="font-mono text-xs border-terminal-amber/40 text-terminal-amber"
            >
              {changedOffsets.size} modified
            </Badge>
            <div className="flex-1" />

            {/* Selected byte editor */}
            {selectedOffset !== null && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  offset: 0x{selectedOffset.toString(16).padStart(4, "0")}
                </span>
                <Input
                  data-ocid="hexeditor.selected_byte.input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.slice(0, 2))}
                  onKeyDown={(e) => e.key === "Enter" && handleByteEdit()}
                  className="font-mono text-xs bg-terminal-bg border-terminal-amber/50 text-terminal-amber h-7 w-14 text-center"
                  maxLength={2}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleByteEdit}
                  className="h-7 font-mono text-xs border-terminal-amber/40 text-terminal-amber hover:bg-terminal-amber/10"
                >
                  Set
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Label className="font-mono text-xs text-muted-foreground">
                Diff
              </Label>
              <Switch
                data-ocid="hexeditor.diff_toggle.toggle"
                checked={showDiff}
                onCheckedChange={setShowDiff}
                className="data-[state=checked]:bg-terminal-cyan"
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              data-ocid="hexeditor.copy_hex.button"
              onClick={handleCopyHex}
              className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 gap-1.5 h-7"
            >
              <Copy className="w-3 h-3" />
              Copy Hex
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-ocid="hexeditor.export_binary.button"
              onClick={handleExportBinary}
              className="font-mono text-xs border-terminal-green/40 text-terminal-green hover:bg-terminal-green/10 gap-1.5 h-7"
            >
              <Download className="w-3 h-3" />
              Export Binary
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOriginalBytes(null);
                setModifiedBytes(null);
                setSelectedOffset(null);
                setEditValue("");
                setPasteInput("");
              }}
              className="font-mono text-xs border-border text-muted-foreground hover:text-foreground h-7"
            >
              Clear
            </Button>
          </div>

          {/* Hex grid(s) */}
          <div
            className={cn(
              "grid gap-4",
              showDiff ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1",
            )}
          >
            {showDiff && originalBytes && (
              <Card className="border-border bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="font-mono text-xs text-muted-foreground">
                    Original
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto max-h-[500px] rounded border border-border bg-terminal-bg p-3">
                    <table>
                      <tbody>{renderHexGrid(originalBytes, true)}</tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-border bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                  {showDiff ? "Modified" : "Hex View"}
                  <Edit3 className="w-3 h-3 text-terminal-cyan" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  data-ocid="hexeditor.canvas_target"
                  className="overflow-auto max-h-[500px] rounded border border-border bg-terminal-bg p-3"
                >
                  <table>
                    <tbody>{renderHexGrid(modifiedBytes)}</tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
