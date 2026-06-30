import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  getAgents,
  getAllAlerts,
  MITRE_TACTICS,
  SEVERITY_META,
  type Alert,
  type Severity,
} from "@/services/wazuhApi";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { format } from "date-fns";
import { AttackChainView } from "@/components/AttackChainView";
import { AiTriagePanel } from "@/components/ai/AiTriagePanel";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Alerts | SentinelView" },
      { name: "description", content: "Searchable Wazuh alert stream with filters." },
    ],
  }),
  component: AlertsPage,
});

const PAGE_SIZE = 15;

function AlertsPage() {
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts", "all"], queryFn: getAllAlerts });
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: getAgents });

  const [search, setSearch] = useState("");
  const [severities, setSeverities] = useState<Severity[]>([]);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [tactics, setTactics] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severities.length && !severities.includes(a.severity)) return false;
      if (agentIds.length && !agentIds.includes(a.agent.id)) return false;
      if (tactics.length && !tactics.includes(a.mitre.tactic)) return false;
      if (from && +new Date(a.timestamp) < +new Date(from)) return false;
      if (to && +new Date(a.timestamp) > +new Date(to)) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = [
          a.rule.description,
          a.agent.name,
          a.mitre.technique_id,
          a.mitre.technique_name,
          a.source_ip ?? "",
          String(a.rule.id),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, search, severities, agentIds, tactics, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggle<T>(arr: T[], v: T, set: (next: T[]) => void) {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
    setPage(0);
  }

  const hasFilters =
    search || severities.length || agentIds.length || tactics.length || from || to;

  return (
    <div className="space-y-5">
      <div className="soc-rise">
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} of {alerts.length} alerts
        </p>
      </div>

      <Card className="soc-card soc-rise soc-delay-1">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder="Search description, agent, MITRE ID, IP…"
                className="pl-9"
              />
            </div>
            <div className="w-[220px]">
              <DateTimePicker
                value={from}
                onChange={(v) => {
                  setFrom(v);
                  setPage(0);
                }}
                placeholder="From"
              />
            </div>
            <div className="w-[220px]">
              <DateTimePicker
                value={to}
                onChange={(v) => {
                  setTo(v);
                  setPage(0);
                }}
                placeholder="To"
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSeverities([]);
                  setAgentIds([]);
                  setTactics([]);
                  setFrom("");
                  setTo("");
                  setPage(0);
                }}
              >
                <X className="h-4 w-4 mr-1" /> Clear
              </Button>
            )}
          </div>

          <FilterRow label="Severity">
            {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
              <Chip
                key={s}
                active={severities.includes(s)}
                onClick={() => toggle(severities, s, setSeverities)}
                colorVar={SEVERITY_META[s].colorVar}
              >
                {SEVERITY_META[s].label}
              </Chip>
            ))}
          </FilterRow>

          <FilterRow label="Agent">
            {agents.map((a) => (
              <Chip
                key={a.id}
                active={agentIds.includes(a.id)}
                onClick={() => toggle(agentIds, a.id, setAgentIds)}
              >
                {a.name}
              </Chip>
            ))}
          </FilterRow>

          <FilterRow label="Tactic">
            {MITRE_TACTICS.map((t) => (
              <Chip
                key={t}
                active={tactics.includes(t)}
                onClick={() => toggle(tactics, t, setTactics)}
              >
                {t}
              </Chip>
            ))}
          </FilterRow>
        </CardContent>
      </Card>

      <Card className="soc-card soc-rise soc-delay-2">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
                <tr>
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Rule</th>
                  <th className="px-3 py-2 font-medium">MITRE</th>
                  <th className="px-3 py-2 font-medium">Source IP</th>
                </tr>
              </thead>
              <tbody>
                {current.map((a) => (
                  <AlertRow
                    key={a.id}
                    alert={a}
                    expanded={expanded === a.id}
                    onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
                  />
                ))}
                {current.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No alerts match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <div>
              Page {page + 1} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground w-16">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  colorVar,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  colorVar?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
      style={active && colorVar ? { borderColor: colorVar, color: colorVar, background: `color-mix(in oklab, ${colorVar} 15%, transparent)` } : undefined}
    >
      {children}
    </button>
  );
}

function AlertRow({
  alert,
  expanded,
  onToggle,
}: {
  alert: Alert;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-border/50 transition-colors duration-150 hover:bg-muted/30 ${
          alert.severity === "critical"
            ? "soc-rail-critical"
            : alert.severity === "high"
              ? "soc-rail-high"
              : ""
        }`}
      >
        <td className="px-3 py-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200" />
          )}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(alert.timestamp), "MMM d, HH:mm:ss")}
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] ${SEVERITY_META[alert.severity].badgeClass}`}
          >
            {SEVERITY_META[alert.severity].label} · L{alert.rule.level}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">{alert.agent.name}</td>
        <td className="px-3 py-2">{alert.rule.description}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{alert.mitre.technique_id}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{alert.source_ip ?? "—"}</td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20 border-b border-border/50">
          <td colSpan={7} className="px-6 py-4">
            <div className="grid gap-4 lg:grid-cols-3 soc-rise">
              <DetailField label="Rule ID">{alert.rule.id}</DetailField>
              <DetailField label="Rule level">{alert.rule.level}</DetailField>
              <DetailField label="Decoder">{alert.decoder ?? "—"}</DetailField>
              <DetailField label="MITRE Tactic">{alert.mitre.tactic}</DetailField>
              <DetailField label="MITRE Technique">
                {alert.mitre.technique_id} · {alert.mitre.technique_name}
              </DetailField>
              <DetailField label="Location">{alert.location ?? "—"}</DetailField>
              <div className="lg:col-span-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Groups
                </div>
                <div className="flex flex-wrap gap-1">
                  {alert.rule.groups.map((g) => (
                    <Badge key={g} variant="outline" className="text-[10px]">
                      {g}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Raw log
                </div>
                <pre className="rounded-md border border-border bg-background p-3 text-[11px] overflow-x-auto whitespace-pre-wrap break-all">
                  {alert.full_log}
                </pre>
              </div>
              <div className="lg:col-span-3">
                <AttackChainView alert={alert} />
              </div>
              <div className="lg:col-span-3">
                <AiTriagePanel alert={alert} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}