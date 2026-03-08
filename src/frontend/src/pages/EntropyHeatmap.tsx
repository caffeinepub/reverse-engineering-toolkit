import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { BarChart2, Download, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const BLOCK_SIZE = 256;
const CELL_SIZE = 16;
const CELL_GAP = 1;

function calculateBlockEntropy(bytes: Uint8Array): number {
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

function entropyToColor(entropy: number): string {
  // 0-2: deep blue, 2-4: teal, 4-6: yellow/amber, 6-7.5: orange, 7.5-8: red
  if (entropy < 2) return "oklch(0.35 0.15 250)";
  if (entropy < 4) return "oklch(0.55 0.15 195)";
  if (entropy < 6) return "oklch(0.72 0.18 85)";
  if (entropy < 7.5) return "oklch(0.68 0.2 50)";
  return "oklch(0.6 0.22 25)";
}

function classifyEntropy(entropy: number): string {
  if (entropy < 2) return "Null/zero data";
  if (entropy < 4) return "Low entropy text";
  if (entropy < 6) return "Code/data";
  if (entropy < 7.5) return "Compressed";
  return "Encrypted/packed";
}

interface BlockInfo {
  index: number;
  offset: number;
  entropy: number;
  classification: string;
}

interface HeatmapData {
  blocks: number[];
  blockInfos: BlockInfo[];
  columns: number;
  filename: string;
  fileSize: number;
  avgEntropy: number;
  minEntropy: number;
  maxEntropy: number;
}

export function EntropyHeatmap() {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    info: BlockInfo;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const createSession = useCreateSession();

  const drawHeatmap = useCallback(
    (data: HeatmapData, canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const { blocks, columns } = data;
      const rows = Math.ceil(blocks.length / columns);
      const totalCellW = CELL_SIZE + CELL_GAP;
      canvas.width = columns * totalCellW + CELL_GAP;
      canvas.height = rows * totalCellW + CELL_GAP;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < blocks.length; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = CELL_GAP + col * totalCellW;
        const y = CELL_GAP + row * totalCellW;
        ctx.fillStyle = entropyToColor(blocks[i]);
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      }
    },
    [],
  );

  useEffect(() => {
    if (heatmapData && canvasRef.current) {
      drawHeatmap(heatmapData, canvasRef.current);
    }
  }, [heatmapData, drawHeatmap]);

  const analyzeFile = async (file: File) => {
    setIsLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const totalBlocks = Math.ceil(bytes.length / BLOCK_SIZE);
      const entropyValues: number[] = [];
      const blockInfos: BlockInfo[] = [];

      for (let i = 0; i < totalBlocks; i++) {
        const block = bytes.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE);
        const entropy = calculateBlockEntropy(block);
        entropyValues.push(entropy);
        blockInfos.push({
          index: i,
          offset: i * BLOCK_SIZE,
          entropy,
          classification: classifyEntropy(entropy),
        });
      }

      const containerW = 600;
      const totalCellW = CELL_SIZE + CELL_GAP;
      const columns = Math.max(1, Math.floor(containerW / totalCellW));
      const avg =
        entropyValues.reduce((a, b) => a + b, 0) / entropyValues.length;
      const min = Math.min(...entropyValues);
      const max = Math.max(...entropyValues);

      const data: HeatmapData = {
        blocks: entropyValues,
        blockInfos,
        columns,
        filename: file.name,
        fileSize: file.size,
        avgEntropy: avg,
        minEntropy: min,
        maxEntropy: max,
      };
      setHeatmapData(data);

      await createSession.mutateAsync({
        filename: file.name,
        tool: "Entropy Heatmap",
        resultSummary: `${totalBlocks} blocks, avg entropy: ${avg.toFixed(3)} bits/byte`,
      });
      toast.success("Analysis complete");
    } catch {
      toast.error("Failed to analyze file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) analyzeFile(file);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!heatmapData || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const totalCellW = CELL_SIZE + CELL_GAP;
    const col = Math.floor((cx - CELL_GAP) / totalCellW);
    const row = Math.floor((cy - CELL_GAP) / totalCellW);
    if (col < 0 || col >= heatmapData.columns) {
      setTooltip(null);
      return;
    }
    const idx = row * heatmapData.columns + col;
    if (idx >= 0 && idx < heatmapData.blockInfos.length) {
      setTooltip({
        x: e.clientX,
        y: e.clientY,
        info: heatmapData.blockInfos[idx],
      });
    } else {
      setTooltip(null);
    }
  };

  const handleExportPNG = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `entropy_${heatmapData?.filename ?? "heatmap"}.png`;
    a.click();
    toast.success("PNG exported");
  };

  const classificationCounts = heatmapData
    ? {
        "Null/zero data": heatmapData.blockInfos.filter((b) => b.entropy < 2)
          .length,
        "Low entropy text": heatmapData.blockInfos.filter(
          (b) => b.entropy >= 2 && b.entropy < 4,
        ).length,
        "Code/data": heatmapData.blockInfos.filter(
          (b) => b.entropy >= 4 && b.entropy < 6,
        ).length,
        Compressed: heatmapData.blockInfos.filter(
          (b) => b.entropy >= 6 && b.entropy < 7.5,
        ).length,
        "Encrypted/packed": heatmapData.blockInfos.filter(
          (b) => b.entropy >= 7.5,
        ).length,
      }
    : null;

  const legendItems = [
    { label: "Null/zero data (0–2)", color: "oklch(0.35 0.15 250)" },
    { label: "Low entropy text (2–4)", color: "oklch(0.55 0.15 195)" },
    { label: "Code/data (4–6)", color: "oklch(0.72 0.18 85)" },
    { label: "Compressed (6–7.5)", color: "oklch(0.68 0.2 50)" },
    { label: "Encrypted/packed (7.5–8)", color: "oklch(0.6 0.22 25)" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ entropy-heatmap
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Visual Shannon entropy analysis — detect packed, encrypted, or
          compressed regions
        </p>
      </div>

      {!heatmapData && (
        <label
          data-ocid="entropy.upload_button"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-200",
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
              const f = e.target.files?.[0];
              if (f) analyzeFile(f);
            }}
          />
          <BarChart2 className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="font-mono text-sm text-foreground font-medium">
            Drop any binary file
          </p>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            PE, ELF, shellcode, firmware — analyzed in 256-byte blocks
          </p>
        </label>
      )}

      {isLoading && (
        <div
          data-ocid="entropy.loading_state"
          className="flex items-center gap-3 p-4 rounded border border-terminal-green/30 bg-terminal-green/5"
        >
          <div className="w-4 h-4 border-2 border-terminal-green border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-terminal-green">
            Computing entropy...
          </span>
        </div>
      )}

      {heatmapData && !isLoading && (
        <div className="space-y-4">
          {/* Stats */}
          <Card
            data-ocid="entropy.stats.panel"
            className="border-border bg-card/60"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="font-mono text-sm text-terminal-cyan">
                  Analysis: {heatmapData.filename}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-ocid="entropy.export_png.button"
                    onClick={handleExportPNG}
                    className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 gap-1.5 h-7"
                  >
                    <Download className="w-3 h-3" />
                    Export PNG
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHeatmapData(null)}
                    className="font-mono text-xs border-border text-muted-foreground h-7"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {[
                  {
                    label: "Total Blocks",
                    value: heatmapData.blocks.length.toLocaleString(),
                    color: "text-terminal-green",
                  },
                  {
                    label: "Avg Entropy",
                    value: `${heatmapData.avgEntropy.toFixed(3)} b/B`,
                    color: "text-terminal-cyan",
                  },
                  {
                    label: "Min Entropy",
                    value: heatmapData.minEntropy.toFixed(3),
                    color: "text-terminal-amber",
                  },
                  {
                    label: "Max Entropy",
                    value: heatmapData.maxEntropy.toFixed(3),
                    color: "text-destructive",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="space-y-0.5">
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                      {stat.label}
                    </p>
                    <p className={`font-mono text-lg font-bold ${stat.color}`}>
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
              {classificationCounts && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(classificationCounts).map(([cls, count]) => (
                    <Badge
                      key={cls}
                      variant="outline"
                      className="font-mono text-xs border-border text-muted-foreground"
                    >
                      {cls}: {count} (
                      {((count / heatmapData.blocks.length) * 100).toFixed(1)}
                      %)
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Heatmap canvas */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-sm text-terminal-cyan">
                Entropy Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative overflow-auto rounded border border-border bg-terminal-bg p-3">
                <canvas
                  ref={canvasRef}
                  data-ocid="entropy.canvas_target"
                  className="block cursor-crosshair"
                  style={{ maxWidth: "100%", imageRendering: "pixelated" }}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={() => setTooltip(null)}
                />
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3">
                {legendItems.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-card border border-border rounded p-2 shadow-lg font-mono text-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="text-terminal-cyan">Block #{tooltip.info.index}</p>
          <p className="text-muted-foreground">
            Offset: 0x{tooltip.info.offset.toString(16).padStart(8, "0")}
          </p>
          <p className="text-terminal-green">
            Entropy: {tooltip.info.entropy.toFixed(4)}
          </p>
          <p className="text-terminal-amber">{tooltip.info.classification}</p>
        </div>
      )}

      {!heatmapData && !isLoading && (
        <div className="flex items-center gap-3 flex-wrap">
          <Upload className="w-4 h-4 text-muted-foreground/40" />
          <span className="font-mono text-xs text-muted-foreground/50">
            Upload a file to see its entropy visualization
          </span>
        </div>
      )}
    </div>
  );
}
