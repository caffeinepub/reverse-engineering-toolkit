import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BinaryIcon,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileSearch,
  LayoutDashboard,
  ScanSearch,
  Terminal,
  Type,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/binary-analyzer", label: "Binary Analyzer", icon: BinaryIcon },
  { path: "/string-extractor", label: "String Extractor", icon: Type },
  { path: "/disassembler", label: "Disassembler", icon: Code2 },
  { path: "/header-inspector", label: "Header Inspector", icon: FileSearch },
  { path: "/pattern-scanner", label: "Pattern Scanner", icon: ScanSearch },
];

function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-300 ease-in-out",
        "border-r border-border bg-sidebar",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          <div className="shrink-0 w-8 h-8 rounded flex items-center justify-center bg-terminal-green/10 border border-terminal-green/30">
            <Terminal className="w-4 h-4 text-terminal-green" />
          </div>
          {!collapsed && (
            <span className="font-mono text-sm font-bold text-terminal-green tracking-wider truncate">
              RE TOOLKIT
            </span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? currentPath === "/"
              : currentPath.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              data-ocid="sidebar.link"
              className={cn(
                "flex items-center gap-3 px-2 py-2.5 rounded transition-all duration-150 group",
                "hover:bg-sidebar-accent hover:text-terminal-green",
                isActive
                  ? "bg-terminal-green/10 text-terminal-green border border-terminal-green/30 glow-green"
                  : "text-muted-foreground border border-transparent",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  "shrink-0 w-4 h-4 transition-colors",
                  isActive
                    ? "text-terminal-green"
                    : "text-muted-foreground group-hover:text-terminal-green",
                )}
              />
              {!collapsed && (
                <span className="font-mono text-xs font-medium tracking-wide truncate">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <div className="p-2 border-t border-border shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-center h-8 rounded text-muted-foreground hover:text-terminal-cyan hover:bg-sidebar-accent transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const currentNav = navItems.find((n) =>
    n.path === "/" ? currentPath === "/" : currentPath.startsWith(n.path),
  );

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      {/* Main area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          collapsed ? "ml-16" : "ml-60",
        )}
      >
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-border flex items-center px-6 gap-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="text-terminal-green">$</span>
            <span>re-toolkit</span>
            <span className="text-terminal-dim">/</span>
            <span className="text-terminal-cyan">
              {currentNav?.label.toLowerCase().replace(/ /g, "-") ?? "unknown"}
            </span>
          </div>
          <div className="flex-1" />
          <div className="font-mono text-xs text-muted-foreground">v1.0.0</div>
          <div
            className="w-2 h-2 rounded-full bg-terminal-green animate-pulse"
            title="Online"
          />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>

        {/* Footer */}
        <footer className="h-8 shrink-0 border-t border-border flex items-center justify-center px-6">
          <p className="font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terminal-cyan hover:text-terminal-green transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
