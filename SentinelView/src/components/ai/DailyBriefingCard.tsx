import { useQuery } from "@tanstack/react-query";
import { FileBarChart2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { generateDailyBriefing, AI_MODE, AI_MODEL } from "@/services/aiService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Alert } from "@/services/wazuhApi";

export function DailyBriefingCard({ alerts }: { alerts: Alert[] }) {
  const q = useQuery({
    queryKey: ["ai", "dailyBriefing"],
    queryFn: () => generateDailyBriefing(alerts, 24),
    enabled: false, // Only run when user clicks generate
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return (
    <Card className="soc-card soc-rise soc-delay-7">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
              <FileBarChart2 className="h-3.5 w-3.5" />
            </span>
            Executive briefing
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            AI-generated daily summary · {AI_MODE === "mock" ? "local model · mock" : `local · ${AI_MODEL}`}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => q.refetch()}
          disabled={q.isFetching}
          className="gap-1.5"
        >
          {q.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : q.data ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {q.data ? "Regenerate" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent>
        {!q.data && !q.isFetching && (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Click <span className="text-foreground">Generate</span> to have the local Qwen2.5 model
            read today's events and produce a management-ready summary.
          </div>
        )}

        {q.isFetching && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card/40 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Reading {alerts.length} alerts, identifying trends, drafting briefing…
          </div>
        )}

        {q.isError && (
          <div className="text-sm text-destructive">
            Could not reach the local AI model. Check that Ollama is running.
          </div>
        )}

        {q.data && (
          <div className="space-y-4 text-sm soc-fade">
            <div className="rounded-md border border-primary/30 bg-primary/[0.05] p-3">
              <div className="text-[10px] uppercase tracking-wider text-primary">Headline</div>
              <div className="mt-1 font-medium leading-snug">{q.data.headline}</div>
            </div>

            <BriefingList title="Trends" items={q.data.trends} />
            <BriefingList title="Top incidents" items={q.data.topIncidents} />
            <BriefingList title="Recommended actions" items={q.data.recommendations} />

            <div className="text-[10px] text-muted-foreground">
              Generated {format(new Date(q.data.generatedAt), "MMM d, hh:mm:ss a")} · window{" "}
              {q.data.windowHours}h
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BriefingList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex gap-2 rounded-md border border-border bg-card/40 px-3 py-2 text-xs leading-relaxed"
          >
            <span className="text-primary">›</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}