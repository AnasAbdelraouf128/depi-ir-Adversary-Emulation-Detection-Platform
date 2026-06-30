import { useQuery } from "@tanstack/react-query";
import { Sparkles, ShieldAlert, Loader2 } from "lucide-react";
import { translateAlert, AI_MODEL, AI_MODE } from "@/services/aiService";
import { SEVERITY_META, type Alert } from "@/services/wazuhApi";

export function AiTriagePanel({ alert }: { alert: Alert }) {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["ai", "triage", alert.id],
    queryFn: () => translateAlert(alert),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <div>
            <div className="text-sm font-semibold">AI Triage</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {AI_MODE === "mock" ? "Local model · mock" : `Local · ${AI_MODEL}`}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {isFetching ? "Analyzing…" : "Re-analyze"}
        </button>
      </div>

      {(isLoading || isFetching) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Qwen2.5 14B is reading the alert…
        </div>
      )}

      {isError && (
        <div className="mt-3 text-xs text-destructive">
          AI analysis unavailable. Is Ollama running on the configured host?
        </div>
      )}

      {data && !isLoading && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="leading-relaxed">{data.summary}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-card/50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                <ShieldAlert className="h-3 w-3" /> Recommended action
              </div>
              <div className="text-xs leading-relaxed">{data.recommendation}</div>
            </div>
            <div className="rounded-md border border-border bg-card/50 p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Indicators
              </div>
              <ul className="space-y-0.5 text-xs">
                {data.indicators.map((i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-primary">›</span>
                    <span className="text-muted-foreground">{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className="inline-block rounded border px-2 py-0.5"
              style={{
                borderColor: SEVERITY_META[data.severity].colorVar,
                color: SEVERITY_META[data.severity].colorVar,
                background: `color-mix(in oklab, ${SEVERITY_META[data.severity].colorVar} 12%, transparent)`,
              }}
            >
              AI classified · {SEVERITY_META[data.severity].label}
              {typeof data.severity_confidence === "number" && (
                <span className="ml-1 opacity-70">
                  ({Math.round(data.severity_confidence * 100)}%)
                </span>
              )}
            </span>
            {data.wazuh_severity && data.wazuh_severity !== data.severity && (
              <span
                className="inline-block rounded border px-2 py-0.5"
                style={{
                  borderColor: SEVERITY_META[data.wazuh_severity].colorVar,
                  color: SEVERITY_META[data.wazuh_severity].colorVar,
                  background: `color-mix(in oklab, ${SEVERITY_META[data.wazuh_severity].colorVar} 8%, transparent)`,
                }}
                title="Severity assigned by the Wazuh rule engine"
              >
                Wazuh · {SEVERITY_META[data.wazuh_severity].label}
              </span>
            )}
            {data.wazuh_severity && data.wazuh_severity !== data.severity && (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                Δ disagrees with Wazuh
              </span>
            )}
            <span className="rounded border border-border bg-card/50 px-2 py-0.5 text-muted-foreground">
              {data.mitre.id} · {data.mitre.tactic}
            </span>
          </div>
          {data.severity_rationale && (
            <div className="rounded-md border border-border bg-card/30 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <span className="mr-1 font-semibold text-foreground/80">Why this severity:</span>
              {data.severity_rationale}
            </div>
          )}
        </div>
      )}
    </div>
  );
}