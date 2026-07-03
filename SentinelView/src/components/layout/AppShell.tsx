import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Shield, LayoutDashboard, ServerCog, AlertTriangle, Target, FileText, Activity, Sparkles, Clock } from "lucide-react";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import {
  WAZUH_API_CONFIGURED,
  WAZUH_INDEXER_CONFIGURED,
  WAZUH_MANAGER_URL,
} from "@/services/wazuhApi";
import { CommandPalette } from "@/components/CommandPalette";

function RealTimeClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded border border-border">
      <Clock className="h-3 w-3 text-primary" />
      {time.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" })}
    </div>
  );
}

const nav: Array<{ to: string; label: string; icon: ReactNode }> = [
  { to: "/", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/agents", label: "Agents", icon: <ServerCog className="h-4 w-4" /> },
  { to: "/alerts", label: "Alerts", icon: <AlertTriangle className="h-4 w-4" /> },
  { to: "/mitre", label: "MITRE ATT&CK", icon: <Target className="h-4 w-4" /> },
  { to: "/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
  { to: "/assistant", label: "AI Assistant", icon: <Sparkles className="h-4 w-4" /> },
];

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const connected = WAZUH_API_CONFIGURED && WAZUH_INDEXER_CONFIGURED;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">SentinelView</div>
            <div className="text-[11px] text-muted-foreground">Wazuh SIEM Console</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => {
            const active =
              n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200 ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border border-sidebar-border shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent)]"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground hover:translate-x-0.5"
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-primary transition-all duration-300 ${
                    active ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0"
                  }`}
                />
                <span className={active ? "text-primary" : "text-current"}>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-border text-xs text-muted-foreground">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                    connected ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    connected ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </span>
              <span className="font-medium text-foreground">
                {connected ? "Wazuh connected" : "Wazuh not configured"}
              </span>
            </div>
            <div className="pl-4 text-[10px] leading-snug">
              {connected
                ? `Manager ${WAZUH_MANAGER_URL}`
                : "Set VITE_WAZUH_API_URL & VITE_WAZUH_INDEXER_URL"}
            </div>
          </div>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">Security Operations Console</span>
            <span className="ml-3 hidden items-center gap-1.5 rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary sm:inline-flex">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Live
            </span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
            <RealTimeClock />
            <kbd className="hidden lg:inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              <span>⌘</span>K
            </kbd>
            <span>
              Manager: <span className="text-foreground">{WAZUH_MANAGER_URL}</span>
            </span>
            <span className="h-3 w-px bg-border" />
            <span>
              Status:{" "}
              <span
                className={
                  connected ? "text-emerald-400" : "text-amber-400"
                }
              >
                {connected ? "ONLINE" : "OFFLINE"}
              </span>
            </span>
          </div>
        </header>
        <main key={pathname} className="soc-backdrop soc-fade min-h-[calc(100vh-3.5rem)] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}