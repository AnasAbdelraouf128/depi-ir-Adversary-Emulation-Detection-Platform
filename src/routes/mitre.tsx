import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAllAlerts, MITRE_TACTICS, SEVERITY_META, type Alert, type Severity } from "@/services/wazuhApi";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/mitre")({
  head: () => ({
    meta: [
      { title: "MITRE ATT&CK | SentinelView" },
      { name: "description", content: "MITRE ATT&CK techniques triggered by Atomic Red Team simulations." },
    ],
  }),
  component: MitrePage,
});

interface TechniqueAgg {
  technique_id: string;
  technique_name: string;
  tactic: string;
  count: number;
  maxSeverity: Severity;
}

const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function MitrePage() {
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts", "all"], queryFn: getAllAlerts });

  const byTactic = new Map<string, TechniqueAgg[]>();
  const techMap = new Map<string, TechniqueAgg>();

  alerts.forEach((a: Alert) => {
    const key = a.mitre.technique_id;
    const cur = techMap.get(key);
    if (cur) {
      cur.count++;
      if (SEVERITY_RANK[a.severity] > SEVERITY_RANK[cur.maxSeverity]) cur.maxSeverity = a.severity;
    } else {
      techMap.set(key, {
        technique_id: a.mitre.technique_id,
        technique_name: a.mitre.technique_name,
        tactic: a.mitre.tactic,
        count: 1,
        maxSeverity: a.severity,
      });
    }
  });

  techMap.forEach((t) => {
    const arr = byTactic.get(t.tactic) ?? [];
    arr.push(t);
    byTactic.set(t.tactic, arr);
  });

  const orderedTactics = MITRE_TACTICS.filter((t) => byTactic.has(t));

  return (
    <div className="space-y-6">
      <div className="soc-rise">
        <h1 className="text-2xl font-semibold tracking-tight">MITRE ATT&CK Coverage</h1>
        <p className="text-sm text-muted-foreground">
          Techniques observed across the monitored endpoints, grouped by tactic.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {orderedTactics.map((tactic, i) => {
          const techs = (byTactic.get(tactic) ?? []).sort((a, b) => b.count - a.count);
          const total = techs.reduce((s, t) => s + t.count, 0);
          return (
            <Card key={tactic} className={`soc-card overflow-hidden soc-rise soc-delay-${Math.min(i + 1, 7)}`}>
              <div className="border-b border-border bg-muted/30 px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm font-medium">{tactic}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {techs.length} {techs.length === 1 ? "technique" : "techniques"} · {total} {total === 1 ? "alert" : "alerts"}
                </span>
              </div>
              <CardContent className="p-3 space-y-2">
                {techs.map((t) => (
                  <div
                    key={t.technique_id}
                    className="rounded-md border border-border bg-card/40 p-3 transition-all duration-200 hover:bg-card/80 hover:translate-x-0.5"
                    style={{
                      borderLeft: `3px solid ${SEVERITY_META[t.maxSeverity].colorVar}`,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-muted-foreground">
                          {t.technique_id}
                        </div>
                        <div className="text-sm truncate">{t.technique_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-semibold tabular-nums">{t.count}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {SEVERITY_META[t.maxSeverity].label}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}