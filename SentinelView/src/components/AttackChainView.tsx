import { Globe, Network, Server, Terminal, Target, ShieldAlert } from "lucide-react";
import {
  getAttackChain,
  TACTIC_COLOR,
  type Alert,
  type AttackStep,
} from "@/services/wazuhApi";

interface Props {
  alert: Alert;
}

export function AttackChainView({ alert }: Props) {
  const chain = getAttackChain(alert);

  const nodes = [
    {
      key: "src",
      icon: <Globe className="h-4 w-4" />,
      label: chain.source.label,
      sub: chain.source.ip ?? "internal",
      tone: "var(--severity-high)",
    },
    {
      key: "hop",
      icon: <Network className="h-4 w-4" />,
      label: chain.hop.label,
      sub: chain.hop.detail,
      tone: "var(--muted-foreground)",
    },
    {
      key: "host",
      icon: <Server className="h-4 w-4" />,
      label: chain.target.host,
      sub: chain.target.os,
      tone: "var(--primary)",
    },
    {
      key: "proc",
      icon: <Terminal className="h-4 w-4" />,
      label: chain.process.label,
      sub: chain.process.detail,
      tone: "var(--primary)",
    },
    {
      key: "obj",
      icon: <Target className="h-4 w-4" />,
      label: alert.mitre.tactic,
      sub: alert.mitre.technique_id,
      tone: "var(--severity-critical)",
    },
  ];

  return (
    <div className="rounded-md border border-border bg-background/40 p-4 soc-rise">
      <div className="mb-3 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Attack chain</h4>
        <span className="text-xs text-muted-foreground">
          Reconstructed kill chain · {chain.steps.length} stages
        </span>
      </div>

      {/* Topology row */}
      <div className="relative overflow-x-auto pb-2">
        <div className="flex min-w-[640px] items-stretch gap-2">
          {nodes.map((n, i) => (
            <div key={n.key} className="flex flex-1 items-center gap-2">
              <div
                className="flex-1 rounded-md border bg-card/60 px-3 py-2 transition-colors"
                style={{
                  borderColor: `color-mix(in oklab, ${n.tone} 35%, transparent)`,
                  boxShadow: `0 0 0 1px color-mix(in oklab, ${n.tone} 12%, transparent) inset`,
                }}
              >
                <div className="flex items-center gap-2 text-xs font-medium" style={{ color: n.tone }}>
                  {n.icon}
                  <span className="truncate">{n.label}</span>
                </div>
                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{n.sub}</div>
              </div>
              {i < nodes.length - 1 && <Connector tone={nodes[i + 1].tone} />}
            </div>
          ))}
        </div>
      </div>

      {/* Step list */}
      <ol className="relative mt-5 space-y-3 pl-2">
        <span className="absolute left-[15px] top-1 bottom-1 w-px bg-border" aria-hidden />
        {chain.steps.map((s) => (
          <Step key={s.index} step={s} />
        ))}
      </ol>
    </div>
  );
}

function Connector({ tone }: { tone: string }) {
  return (
    <svg
      className="h-6 w-8 shrink-0"
      viewBox="0 0 32 24"
      fill="none"
      aria-hidden
    >
      <defs>
        <marker
          id={`arr-${tone.replace(/[^a-z0-9]/gi, "")}`}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 Z" fill={tone} />
        </marker>
      </defs>
      <line
        x1="0"
        y1="12"
        x2="26"
        y2="12"
        stroke={tone}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        markerEnd={`url(#arr-${tone.replace(/[^a-z0-9]/gi, "")})`}
        style={{ animation: "soc-dash 1.6s linear infinite" }}
      />
    </svg>
  );
}

function Step({ step }: { step: AttackStep }) {
  const color = TACTIC_COLOR[step.tactic] ?? "var(--primary)";
  const observed = step.status === "observed";
  return (
    <li className="relative pl-9">
      <span
        className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums"
        style={{
          background: `color-mix(in oklab, ${color} 18%, var(--card))`,
          borderColor: `color-mix(in oklab, ${color} 60%, transparent)`,
          color,
          boxShadow: observed
            ? `0 0 0 3px color-mix(in oklab, ${color} 20%, transparent)`
            : undefined,
        }}
      >
        {step.index}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
          style={{
            color,
            borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
            background: `color-mix(in oklab, ${color} 10%, transparent)`,
          }}
        >
          {step.tactic}
        </span>
        {step.technique_id && (
          <span className="text-[10px] text-muted-foreground">
            {step.technique_id} · {step.technique_name}
          </span>
        )}
        <span
          className={`ml-auto text-[10px] uppercase tracking-wider ${
            observed ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {observed ? "Observed" : "Inferred"}
        </span>
      </div>
      <div className="mt-0.5 text-sm">{step.title}</div>
      <div className="text-xs text-muted-foreground">{step.detail}</div>
      {step.indicator && (
        <pre className="mt-1 overflow-x-auto rounded border border-border bg-background/60 p-2 text-[10px] text-muted-foreground">
          {step.indicator}
        </pre>
      )}
    </li>
  );
}