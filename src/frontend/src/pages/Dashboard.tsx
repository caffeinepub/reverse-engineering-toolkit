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
import {
  useClearAllSessions,
  useDeleteSession,
  useGetSessions,
} from "@/hooks/useQueries";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  BinaryIcon,
  Clock,
  Code2,
  Database,
  FileSearch,
  Files,
  ScanSearch,
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
};

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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

      {/* Recent sessions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-mono text-sm font-semibold text-muted-foreground uppercase tracking-widest">
            Recent Sessions
          </h2>
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
                  session{totalSessions !== 1 ? "s" : ""}. This action cannot be
                  undone.
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
                <TableHead className="w-12" />
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
              ) : sessions && sessions.length > 0 ? (
                [...sessions]
                  .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
                  .map((session, idx) => (
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
