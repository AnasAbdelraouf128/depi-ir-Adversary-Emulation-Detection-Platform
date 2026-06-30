import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Server,
} from "lucide-react";
import { getAgents, getAllAlerts, SEVERITY_META, type Severity } from "@/services/wazuhApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DailyBriefingCard } from "@/components/ai/DailyBriefingCard";
import { Sparkline } from "@/components/Sparkline";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview | SentinelView" },
      { name: "description", content: "Wazuh SIEM security operations dashboard overview." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts", "all"], queryFn: getAllAlerts });
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: getAgents });

  const now = Date.now();
  const last24h = alerts.filter((a) => now - +new Date(a.timestamp) <= 24 * 3600 * 1000);
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  last24h.forEach((a) => counts[a.severity]++);

  // 24h hourly buckets per severity (and total) for sparklines
  function hourly(predicate: (a: typeof alerts[number]) => boolean) {
    const buckets = new Array(24).fill(0);
    for (const a of alerts) {
      const diffH = Math.floor((now - +new Date(a.timestamp)) / 3600_000);
      if (diffH >= 0 && diffH < 24 && predicate(a)) buckets[23 - diffH]++;
    }
    return buckets;
  }
  const sparkAll = hourly(() => true);
  const sparkCrit = hourly((a) => a.severity === "critical");
  const sparkHigh = hourly((a) => a.severity === "high");
  const sparkMed = hourly((a) => a.severity === "medium");
  const sparkLow = hourly((a) => a.severity === "low");

  // build 7-day time series (per day, severity stacked into total)
  const days: { date: string; total: number; critical: number; high: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now - i * 24 * 3600 * 1000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = dayStart.getTime() + 24 * 3600 * 1000;
    const inDay = alerts.filter((a) => {
      const t = +new Date(a.timestamp);
      return t >= dayStart.getTime() && t < dayEnd;
    });
    days.push({
      date: dayStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      total: inDay.length,
      critical: inDay.filter((a) => a.severity === "critical").length,
      high: inDay.filter((a) => a.severity === "high").length,
    });
  }

  const pieData = (["critical", "high", "medium", "low"] as Severity[]).map((s) => ({
    name: SEVERITY_META[s].label,
    value: alerts.filter((a) => a.severity === s).length,
    color: SEVERITY_META[s].colorVar,
  }));

  const topRules = Object.values(
    alerts.reduce<Record<string, { description: string; count: number; severity: Severity }>>(
      (acc, a) => {
        const key = String(a.rule.id);
        if (!acc[key]) acc[key] = { description: a.rule.description, count: 0, severity: a.severity };
        acc[key].count++;
        return acc;
      },
      {},
    ),
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="soc-rise">
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Last 24 hours of SIEM activity across {agents.length} monitored endpoint
          {agents.length === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Alerts (24h)"
          value={last24h.length}
          tone="primary"
          delay={1}
          spark={sparkAll}
        />
        <StatCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Critical"
          value={counts.critical}
          tone="critical"
          delay={2}
          pulse={counts.critical > 0}
          spark={sparkCrit}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="High"
          value={counts.high}
          tone="high"
          delay={3}
          spark={sparkHigh}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Medium"
          value={counts.medium}
          tone="medium"
          delay={4}
          spark={sparkMed}
        />
        <StatCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Low"
          value={counts.low}
          tone="low"
          delay={5}
          spark={sparkLow}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 soc-card soc-rise soc-delay-3">
          <CardHeader>
            <CardTitle className="text-base">Alerts over the last 7 days</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={days}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--primary)"
                  fill="url(#gTotal)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="soc-card soc-rise soc-delay-4">
          <CardHeader>
            <CardTitle className="text-base">Severity breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-72 flex flex-col">
            <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="var(--card)"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs shrink-0">
              {pieData.map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                  <span className="text-muted-foreground">{p.name}</span>
                  <span className="ml-auto text-foreground">{p.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="soc-card soc-rise soc-delay-5">
          <CardHeader>
            <CardTitle className="text-base">Monitored agents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agents.map((a) => (
              <div
                key={a.id}
                className="soc-row flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.os.name} · {a.ip}
                    </div>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={
                    a.status === "active"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-500/40 bg-zinc-500/10 text-zinc-400"
                  }
                >
                  <span className="relative mr-1.5 inline-flex h-1.5 w-1.5">
                    {a.status === "active" && (
                      <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping" />
                    )}
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                  </span>
                  {a.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="soc-card soc-rise soc-delay-6">
          <CardHeader>
            <CardTitle className="text-base">Top triggered rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topRules.map((r) => (
              <div
                key={r.description}
                className="soc-row flex items-center justify-between rounded-md border border-border bg-card/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full`}
                    style={{ background: SEVERITY_META[r.severity].colorVar }}
                  />
                  <span className="truncate">{r.description}</span>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{r.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <DailyBriefingCard alerts={alerts} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  delay,
  pulse,
  spark,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "critical" | "high" | "medium" | "low";
  delay?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  pulse?: boolean;
  spark?: number[];
}) {
  const colorVar =
    tone === "primary"
      ? "var(--primary)"
      : tone === "critical"
        ? "var(--severity-critical)"
        : tone === "high"
          ? "var(--severity-high)"
          : tone === "medium"
            ? "var(--severity-medium)"
            : "var(--severity-low)";
  const display = useCountUp(value);
  const delayClass = delay ? `soc-delay-${delay}` : "";
  return (
    <Card className={`soc-card soc-rise ${delayClass} ${pulse ? "soc-glow-critical" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md"
            style={{ background: `color-mix(in oklab, ${colorVar} 18%, transparent)`, color: colorVar }}
          >
            {icon}
          </span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="text-2xl font-semibold tabular-nums leading-none" style={{ color: colorVar }}>
            {display}
          </div>
          {spark && spark.length > 0 && (
            <Sparkline data={spark} color={colorVar} height={22} width={70} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function useCountUp(target: number, durationMs = 800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setV(0);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setV(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}
