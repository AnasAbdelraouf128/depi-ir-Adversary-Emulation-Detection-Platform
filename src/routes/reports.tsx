import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { getAllAlerts, SEVERITY_META, type Severity } from "@/services/wazuhApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Download, FileText, Printer } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports | SentinelView" },
      { name: "description", content: "Generate and export Wazuh SIEM reports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts", "all"], queryFn: getAllAlerts });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const [from, setFrom] = useState(format(weekAgo, "yyyy-MM-dd'T'HH:mm"));
  const [to, setTo] = useState(format(now, "yyyy-MM-dd'T'HH:mm"));

  const filtered = useMemo(() => {
    const f = +new Date(from);
    const t = +new Date(to);
    return alerts.filter((a) => {
      const ts = +new Date(a.timestamp);
      return ts >= f && ts <= t;
    });
  }, [alerts, from, to]);

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  filtered.forEach((a) => counts[a.severity]++);

  const topRules = Object.values(
    filtered.reduce<Record<string, { id: number; description: string; count: number; severity: Severity }>>(
      (acc, a) => {
        const key = String(a.rule.id);
        if (!acc[key]) acc[key] = { id: a.rule.id, description: a.rule.description, count: 0, severity: a.severity };
        acc[key].count++;
        return acc;
      },
      {},
    ),
  )
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  function exportCsv() {
    const headers = [
      "id",
      "timestamp",
      "agent_id",
      "agent_name",
      "rule_id",
      "rule_level",
      "severity",
      "description",
      "mitre_id",
      "mitre_name",
      "tactic",
      "source_ip",
    ];
    const rows = filtered.map((a) =>
      [
        a.id,
        a.timestamp,
        a.agent.id,
        a.agent.name,
        a.rule.id,
        a.rule.level,
        a.severity,
        a.rule.description.replace(/"/g, '""'),
        a.mitre.technique_id,
        a.mitre.technique_name.replace(/"/g, '""'),
        a.mitre.tactic,
        a.source_ip ?? "",
      ]
        .map((v) => `"${String(v)}"`)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wazuh-alerts-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function escapeHtml(unsafe: string | undefined | null) {
    if (!unsafe) return "";
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function exportPdf() {
    try {
      const sevRows = (["critical", "high", "medium", "low"] as Severity[])
        .map(
          (s) =>
            `<tr><td>${SEVERITY_META[s].label}</td><td style="text-align:right">${counts[s]}</td></tr>`,
        )
        .join("");
      const ruleRows = topRules
        .map(
          (r) =>
            `<tr><td>${r.id}</td><td>${escapeHtml(r.description)}</td><td>${r.severity}</td><td style="text-align:right">${r.count}</td></tr>`,
        )
        .join("");
        
      const htmlContent = `<!doctype html><html><head><title>Wazuh SIEM Report</title>
        <style>
          body{font-family:ui-sans-serif,system-ui,sans-serif;color:#111;padding:32px;max-width:800px;margin:auto}
          h1{margin:0 0 4px;font-size:20px}
          h2{margin:24px 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#555}
          table{width:100%;border-collapse:collapse;font-size:12px}
          td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}
          thead{background:#f4f4f5}
          .meta{font-size:12px;color:#555;margin-bottom:8px}
        </style></head><body>
        <h1>Wazuh SIEM Report</h1>
        <div class="meta">Generated ${format(new Date(), "PPpp")}</div>
        <div class="meta">Range: ${format(new Date(from), "PPpp")} &rarr; ${format(new Date(to), "PPpp")}</div>
        <div class="meta">Total alerts: <strong>${filtered.length}</strong></div>
        <h2>Severity totals</h2>
        <table><thead><tr><th>Severity</th><th style="text-align:right">Count</th></tr></thead><tbody>${sevRows}</tbody></table>
        <h2>Top triggered rules</h2>
        <table><thead><tr><th>Rule ID</th><th>Description</th><th>Severity</th><th style="text-align:right">Count</th></tr></thead><tbody>${ruleRows}</tbody></table>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 250);
          };
        </script>
        </body></html>`;

      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank", "noopener,noreferrer,width=900,height=1100");
      
      // Cleanup the object URL after the window is done loading
      if (w) {
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (e: any) {
      alert("Error generating PDF: " + e.message + "\n" + e.stack);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports & Export</h1>
        <p className="text-sm text-muted-foreground">
          Summarize and export alert data for the selected date range.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-1.5">
              From
            </label>
            <DateTimePicker value={from} onChange={setFrom} />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80 block mb-1.5">
              To
            </label>
            <DateTimePicker value={to} onChange={setTo} />
          </div>
          <div className="flex items-end gap-2 ml-auto">
            <Button onClick={exportCsv} variant="outline" className="h-10">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={exportPdf} className="h-10">
              <Printer className="h-4 w-4 mr-2" /> Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {SEVERITY_META[s].label}
              </div>
              <div
                className="mt-2 text-2xl font-semibold tabular-nums"
                style={{ color: SEVERITY_META[s].colorVar }}
              >
                {counts[s]}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Report summary — {filtered.length} alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
                <tr>
                  <th className="px-4 py-2 font-medium">Rule ID</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Severity</th>
                  <th className="px-4 py-2 font-medium text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {topRules.map((r) => (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="px-4 py-2 font-mono text-xs">{r.id}</td>
                    <td className="px-4 py-2">{r.description}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] ${SEVERITY_META[r.severity].badgeClass}`}
                      >
                        {SEVERITY_META[r.severity].label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.count}</td>
                  </tr>
                ))}
                {topRules.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No alerts in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}