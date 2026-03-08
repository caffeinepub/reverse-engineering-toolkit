import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useClearAllSessions,
  useDeleteSession,
  useGetSessions,
  useUpdateSessionNote,
} from "@/hooks/useQueries";
import type { AnalysisSession } from "@/hooks/useQueries";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BarChart2,
  BinaryIcon,
  Clock,
  Code2,
  Database,
  Download,
  Edit3,
  FileSearch,
  Files,
  GitCompare,
  Hash,
  MessageSquare,
  Package,
  ScanSearch,
  Shield,
  Shuffle,
  Table2,
  Trash2,
  Type,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const tools = [
  {
    path: "/binary-analyzer",
    label: "Binary Analyzer",
    icon: BinaryIcon,
    desc: "Hex dump & entropy analysis",
  },
  {
    path: "/string-extractor",
    label: "String Extractor",
    icon: Type,
    desc: "Extract printable strings",
  },
  {
    path: "/disassembler",
    label: "Disassembler",
    icon: Code2,
    desc: "Hex bytes to instructions",
  },
  {
    path: "/header-inspector",
    label: "Header Inspector",
    icon: FileSearch,
    desc: "PE/ELF header parser",
  },
  {
    path: "/pattern-scanner",
    label: "Pattern Scanner",
    icon: ScanSearch,
    desc: "Byte pattern search",
  },
  {
    path: "/checksums",
    label: "Checksums",
    icon: Hash,
    desc: "MD5, CRC32, SHA hashes",
  },
  {
    path: "/deobfuscator",
    label: "Deobfuscator",
    icon: Shuffle,
    desc: "Multi-method decode",
  },
  {
    path: "/file-diff",
    label: "File Diff",
    icon: GitCompare,
    desc: "Byte-level file compare",
  },
  {
    path: "/yara-rule",
    label: "YARA Builder",
    icon: Shield,
    desc: "YARA rule generator",
  },
  {
    path: "/hex-editor",
    label: "Hex Editor",
    icon: Edit3,
    desc: "Interactive byte editor",
  },
  {
    path: "/entropy-heatmap",
    label: "Entropy Map",
    icon: BarChart2,
    desc: "Visual entropy analysis",
  },
  {
    path: "/import-table",
    label: "Import Table",
    icon: Table2,
    desc: "PE import analyzer",
  },
  {
    path: "/pe-resources",
    label: "PE Resources",
    icon: Package,
    desc: "Resource extractor",
  },
];

function formatTimestamp(ts: bigint) {
  const ms = Number(ts);
  if (ms === 0) return "—";
  return new Date(ms).toLocaleString();
}

function isToday(ts: bigint) {
  const d = new Date(Number(ts));
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

const toolColors: Record<string, string> = {
  "Binary Analyzer":
    "text-terminal-green border-terminal-green/40 bg-terminal-green/10",
  "String Extractor":
    "text-terminal-cyan border-terminal-cyan/40 bg-terminal-cyan/10",
  Disassembler:
    "text-terminal-amber border-terminal-amber/40 bg-terminal-amber/10",
  "Header Inspector": "text-purple-400 border-purple-400/40 bg-purple-400/10",
  "Pattern Scanner": "text-pink-400 border-pink-400/40 bg-pink-400/10",
  Checksums: "text-teal-400 border-teal-400/40 bg-teal-400/10",
  Deobfuscator: "text-orange-400 border-orange-400/40 bg-orange-400/10",
  "File Diff": "text-sky-400 border-sky-400/40 bg-sky-400/10",
  "YARA Builder": "text-lime-400 border-lime-400/40 bg-lime-400/10",
  "Hex Editor": "text-violet-400 border-violet-400/40 bg-violet-400/10",
  "Entropy Map": "text-rose-400 border-rose-400/40 bg-rose-400/10",
  "Import Table": "text-amber-400 border-amber-400/40 bg-amber-400/10",
  "PE Resources": "text-indigo-400 border-indigo-400/40 bg-indigo-400/10",
};

// ─── Session Note Dialog ─────────────────────────────────────────────────────
function SessionNoteDialog({
  session,
  idx,
}: {
  session: AnalysisSession;
  idx: number;
}) {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState(session.note);
  const updateNote = useUpdateSessionNote();

  const handleSave = async () => {
    try {
      await updateNote.mutateAsync({ id: session.id, note: noteText });
      setOpen(false);
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-ocid={`dashboard.sessions.edit_button.${idx + 1}`}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-terminal-cyan hover:bg-terminal-cyan/10"
          title="Add/edit note"
        >
          <MessageSquare className="w-3 h-3" />
        </Button>
      </DialogTrigger>
      <DialogContent
        data-ocid="dashboard.note.dialog"
        className="border-border bg-card font-mono max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-terminal-cyan text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Session Note
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {session.filename} — {session.tool}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          data-ocid="dashboard.note.textarea"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a note about this session..."
          className="font-mono text-xs bg-terminal-bg border-border text-terminal-green placeholder:text-muted-foreground/40 resize-none h-28"
        />
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            data-ocid="dashboard.note.cancel_button"
            onClick={() => {
              setNoteText(session.note);
              setOpen(false);
            }}
            className="font-mono text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            data-ocid="dashboard.note.save_button"
            onClick={handleSave}
            disabled={updateNote.isPending}
            className="font-mono text-xs bg-terminal-green/10 border border-terminal-green/40 text-terminal-green hover:bg-terminal-green/20"
            variant="outline"
          >
            {updateNote.isPending ? "Saving..." : "Save Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tool Usage Bar Chart (pure SVG) ─────────────────────────────────────────
function ToolBarChart({ toolCounts }: { toolCounts: Record<string, number> }) {
  const entries = Object.entries(toolCounts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);

  const barColors: Record<string, string> = {
    "Binary Analyzer": "oklch(0.78 0.2 145)",
    "String Extractor": "oklch(0.7 0.18 200)",
    Disassembler: "oklch(0.72 0.18 60)",
    "Header Inspector": "oklch(0.65 0.2 300)",
    "Pattern Scanner": "oklch(0.65 0.22 350)",
    Checksums: "oklch(0.7 0.18 175)",
    Deobfuscator: "oklch(0.72 0.2 50)",
    "File Diff": "oklch(0.68 0.18 230)",
    "YARA Builder": "oklch(0.75 0.2 135)",
    "Hex Editor": "oklch(0.68 0.2 280)",
    "Entropy Map": "oklch(0.65 0.22 20)",
    "Import Table": "oklch(0.72 0.18 55)",
    "PE Resources": "oklch(0.68 0.2 265)",
  };

  const barWidth = 28;
  const gap = 12;
  const chartH = 80;
  const labelH = 60;
  const totalW = entries.length * (barWidth + gap);

  return (
    <Card className="border-border bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="font-mono text-sm text-terminal-cyan">
          Sessions by Tool
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <svg
            role="img"
            aria-label="Sessions per tool bar chart"
            width={Math.max(totalW, 300)}
            height={chartH + labelH + 20}
            className="font-mono"
          >
            <title>Sessions per tool</title>
            {entries.map(([tool, count], i) => {
              const barH = Math.max((count / max) * chartH, 4);
              const x = i * (barWidth + gap);
              const y = chartH - barH;
              const color = barColors[tool] ?? "oklch(0.5 0.1 200)";
              return (
                <g key={tool}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barH}
                    fill={color}
                    opacity={0.7}
                    rx={2}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={9}
                    fill={color}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {count}
                  </text>
                  {/* Rotated label */}
                  <text
                    x={x + barWidth / 2}
                    y={chartH + 8}
                    textAnchor="end"
                    fontSize={8}
                    fill="oklch(0.5 0.04 200)"
                    fontFamily="JetBrains Mono, monospace"
                    transform={`rotate(-40, ${x + barWidth / 2}, ${chartH + 8})`}
                  >
                    {tool.length > 12 ? `${tool.slice(0, 11)}…` : tool}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { data: sessions, isLoading } = useGetSessions();
  const deleteSession = useDeleteSession();
  const clearAll = useClearAllSessions();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const totalSessions = sessions?.length ?? 0;
  const todaySessions =
    sessions?.filter((s) => isToday(s.timestamp)).length ?? 0;
  const uniqueFiles = new Set(sessions?.map((s) => s.filename) ?? []).size;

  const toolCounts: Record<string, number> = {};
  for (const s of sessions ?? []) {
    toolCounts[s.tool] = (toolCounts[s.tool] ?? 0) + 1;
  }
  const mostUsedTool =
    Object.entries(toolCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const handleDelete = async (id: bigint) => {
    try {
      await deleteSession.mutateAsync(id);
      toast.success("Session deleted");
    } catch {
      toast.error("Failed to delete session");
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAll.mutateAsync();
      setClearDialogOpen(false);
      toast.success("All sessions cleared");
    } catch {
      toast.error("Failed to clear sessions");
    }
  };

  const handleExportSessions = () => {
    if (!sessions?.length) return;
    const data = sessions.map((s) => ({
      id: s.id.toString(),
      filename: s.filename,
      tool: s.tool,
      timestamp: new Date(Number(s.timestamp)).toISOString(),
      resultSummary: s.resultSummary,
      note: s.note,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "re-toolkit-sessions.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Sessions exported");
  };

  const sortedSessions = sessions
    ? [...sessions].sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    : [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ dashboard
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Reverse engineering workspace overview
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Sessions",
            value: totalSessions,
            icon: Database,
            color: "text-terminal-green",
          },
          {
            label: "Most Used Tool",
            value: mostUsedTool,
            icon: Zap,
            color: "text-terminal-cyan",
          },
          {
            label: "Sessions Today",
            value: todaySessions,
            icon: Clock,
            color: "text-terminal-amber",
          },
          {
            label: "Files Analyzed",
            value: uniqueFiles,
            icon: Files,
            color: "text-purple-400",
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            data-ocid="dashboard.stat.card"
            className="border-border bg-card/60 backdrop-blur-sm relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-terminal-green/3 to-transparent pointer-events-none" />
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                    {stat.label}
                  </p>
                  {isLoading ? (
                    <Skeleton className="h-8 w-16" />
                  ) : (
                    <p
                      className={`font-mono text-2xl font-bold ${stat.color} truncate max-w-[120px]`}
                    >
                      {typeof stat.value === "number"
                        ? stat.value.toLocaleString()
                        : stat.value}
                    </p>
                  )}
                </div>
                <div
                  className={`p-2 rounded border border-current/20 ${stat.color} bg-current/10`}
                >
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick launch */}
      <div>
        <h2 className="font-mono text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Quick Launch
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                type="button"
                key={tool.path}
                data-ocid="dashboard.quick_launch.button"
                onClick={() => navigate({ to: tool.path })}
                className="group p-4 rounded border border-border bg-card/60 hover:border-terminal-green/50 hover:bg-terminal-green/5 transition-all duration-200 text-left"
              >
                <Icon className="w-5 h-5 text-muted-foreground group-hover:text-terminal-green transition-colors mb-2" />
                <p className="font-mono text-xs font-semibold text-foreground group-hover:text-terminal-green transition-colors">
                  {tool.label}
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-1 leading-relaxed">
                  {tool.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bar chart */}
      {!isLoading && Object.keys(toolCounts).length > 0 && (
        <ToolBarChart toolCounts={toolCounts} />
      )}

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-mono text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Recent Sessions
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              data-ocid="dashboard.export_sessions.button"
              onClick={handleExportSessions}
              disabled={totalSessions === 0}
              className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 gap-1.5"
            >
              <Download className="w-3 h-3" />
              Export Sessions
            </Button>
            <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-ocid="dashboard.clear_all.button"
                  className="font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2"
                  disabled={totalSessions === 0}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Clear All
                </Button>
              </DialogTrigger>
              <DialogContent
                data-ocid="dashboard.clear_all.dialog"
                className="border-destructive/40 bg-card font-mono"
              >
                <DialogHeader>
                  <DialogTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Clear All Sessions?
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                    This will permanently delete all {totalSessions} analysis
                    session{totalSessions !== 1 ? "s" : ""}. This action cannot
                    be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-ocid="dashboard.clear_all.cancel_button"
                    onClick={() => setClearDialogOpen(false)}
                    className="font-mono text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    data-ocid="dashboard.clear_all.confirm_button"
                    onClick={handleClearAll}
                    disabled={clearAll.isPending}
                    className="font-mono text-xs"
                  >
                    {clearAll.isPending ? "Clearing..." : "Clear All"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="rounded border border-border overflow-hidden">
          <Table data-ocid="dashboard.sessions.table">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Filename
                </TableHead>
                <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Tool
                </TableHead>
                <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Timestamp
                </TableHead>
                <TableHead className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Summary
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                (["s1", "s2", "s3"] as const).map((sk) => (
                  <TableRow key={sk} className="border-border">
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))
              ) : sortedSessions.length > 0 ? (
                sortedSessions.map((session, idx) => (
                  <TableRow
                    key={session.id.toString()}
                    data-ocid={`dashboard.sessions.row.${idx + 1}`}
                    className="border-border hover:bg-muted/20 font-mono text-xs"
                  >
                    <TableCell className="text-foreground max-w-[160px] truncate">
                      {session.filename}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs font-mono ${toolColors[session.tool] ?? "text-muted-foreground"}`}
                      >
                        {session.tool}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTimestamp(session.timestamp)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {session.resultSummary}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <SessionNoteDialog session={session} idx={idx} />
                        <Button
                          variant="ghost"
                          size="sm"
                          data-ocid={`dashboard.sessions.delete_button.${idx + 1}`}
                          onClick={() => handleDelete(session.id)}
                          disabled={deleteSession.isPending}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    data-ocid="dashboard.sessions.empty_state"
                    className="text-center py-12 font-mono text-xs text-muted-foreground"
                  >
                    <div className="space-y-2">
                      <p className="text-terminal-dim">
                        {"// No sessions found"}
                      </p>
                      <p className="text-muted-foreground/50">
                        Use a tool to create your first analysis session
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
