import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAgentStatus, getAllAlerts, SEVERITY_META } from "@/services/wazuhApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Server } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/agents/$agentId")({
  head: () => ({
    meta: [{ title: "Agent | SentinelView" }],
  }),
  component: AgentDetail,
});

function AgentDetail() {
  const { agentId } = Route.useParams();
  const { data: agent } = useQuery({
    queryKey: ["agent", agentId],
    queryFn: () => getAgentStatus(agentId),
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts", "all"],
    queryFn: getAllAlerts,
  });

  if (!agent) {
    return (
      <div className="text-sm text-muted-foreground">
        Agent not found.{" "}
        <Link to="/agents" className="text-primary underline">
          Back to agents
        </Link>
      </div>
    );
  }

  const agentAlerts = alerts.filter((a) => a.agent.id === agent.id).slice(0, 50);

  return (
    <div className="space-y-6">
      <Link
        to="/agents"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All agents
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Server className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{agent.name}</h1>
              <p className="text-xs text-muted-foreground">
                Agent {agent.id} · {agent.os.name} {agent.os.version} · {agent.ip}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <div>{agent.version}</div>
              <div>
                Last keep-alive{" "}
                {formatDistanceToNow(new Date(agent.lastKeepAlive), { addSuffix: true })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent alerts ({agentAlerts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Severity</th>
                  <th className="px-4 py-2 font-medium">Rule</th>
                  <th className="px-4 py-2 font-medium">MITRE</th>
                </tr>
              </thead>
              <tbody>
                {agentAlerts.map((a) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(a.timestamp), "MMM d, hh:mm:ss a")}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] ${SEVERITY_META[a.severity].badgeClass}`}
                      >
                        {SEVERITY_META[a.severity].label} · L{a.rule.level}
                      </span>
                    </td>
                    <td className="px-4 py-2">{a.rule.description}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {a.mitre.technique_id} · {a.mitre.technique_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}