import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAgents, getAllAlerts, SEVERITY_META } from "@/services/wazuhApi";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Server } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/agents")({
  head: () => ({
    meta: [
      { title: "Agents | SentinelView" },
      { name: "description", content: "Monitored Wazuh agents and their status." },
    ],
  }),
  component: AgentsPage,
});

function AgentsPage() {
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: getAgents });
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts", "all"], queryFn: getAllAlerts });

  return (
    <div className="space-y-6">
      <div className="soc-rise">
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Endpoints reporting to the Wazuh manager.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((a, i) => {
          const agentAlerts = alerts.filter((x) => x.agent.id === a.id);
          const sev = {
            critical: agentAlerts.filter((x) => x.severity === "critical").length,
            high: agentAlerts.filter((x) => x.severity === "high").length,
            medium: agentAlerts.filter((x) => x.severity === "medium").length,
            low: agentAlerts.filter((x) => x.severity === "low").length,
          };
          return (
            <Link
              key={a.id}
              to="/agents/$agentId"
              params={{ agentId: a.id }}
              className={`group soc-rise soc-delay-${Math.min(i + 1, 7)}`}
            >
              <Card className="soc-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Server className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-base font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Agent ID {a.id} · {a.version}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <Row label="Status">
                      <Badge
                        variant="outline"
                        className={
                          a.status === "active"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-zinc-500/40 bg-zinc-500/10 text-zinc-400"
                        }
                      >
                        {a.status}
                      </Badge>
                    </Row>
                    <Row label="OS">{a.os.name}</Row>
                    <Row label="IP">{a.ip}</Row>
                    <Row label="Last keep-alive">
                      {a.id === "000" ? "Always Online" : formatDistanceToNow(new Date(a.lastKeepAlive), { addSuffix: true })}
                    </Row>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["critical", "high", "medium", "low"] as const).map((s) => (
                      <span
                        key={s}
                        className={`rounded-md border px-2 py-1 text-[11px] ${SEVERITY_META[s].badgeClass}`}
                      >
                        {SEVERITY_META[s].label}: {sev[s]}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right">{children}</span>
    </div>
  );
}