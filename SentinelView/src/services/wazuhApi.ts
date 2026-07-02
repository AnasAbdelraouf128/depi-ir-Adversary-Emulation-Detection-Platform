/**
 * Wazuh data service.
 *
 * Live integration with:
 *   • Wazuh Manager REST API   (default port 55000) — agents, status
 *   • Wazuh Indexer (OpenSearch, default port 9200) — alerts
 *
 * Configure via Vite env vars (e.g. in `.env.local`):
 *
 *   VITE_WAZUH_API_URL=https://<EC2_ELASTIC_IP>:55000
 *   VITE_WAZUH_API_USER=wazuh-wui
 *   VITE_WAZUH_API_PASS=<password>
 *   VITE_WAZUH_INDEXER_URL=https://<EC2_ELASTIC_IP>:9200
 *   VITE_WAZUH_INDEXER_USER=admin
 *   VITE_WAZUH_INDEXER_PASS=<password>
 *
 * Note: these credentials are exposed to the browser. For production,
 * proxy these calls through your own backend instead of calling the
 * manager/indexer directly from the client.
 *
 * When env vars are missing, every function resolves to an empty result
 * so the UI renders cleanly with "no data yet" instead of crashing.
 */

export type Severity = "critical" | "high" | "medium" | "low";

export interface Agent {
  id: string;
  name: string;
  ip: string;
  os: { platform: string; name: string; version: string };
  status: "active" | "disconnected" | "pending";
  version: string;
  lastKeepAlive: string;
  registeredAt: string;
}

export interface MitreMapping {
  technique_id: string;
  technique_name: string;
  tactic: string;
}

export interface Alert {
  id: string;
  timestamp: string;
  agent: { id: string; name: string };
  rule: {
    id: number;
    level: number;
    description: string;
    groups: string[];
  };
  severity: Severity;
  mitre: MitreMapping;
  source_ip?: string;
  full_log: string;
  decoder?: string;
  location?: string;
}

export interface AlertFilters {
  severity?: Severity[];
  agentIds?: string[];
  tactics?: string[];
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// -- Config --------------------------------------------------------------

let API_URL = (import.meta.env.VITE_WAZUH_API_URL ?? "").replace(/\/+$/, "");
const API_USER = import.meta.env.VITE_WAZUH_API_USER ?? "";

let IDX_URL = (import.meta.env.VITE_WAZUH_INDEXER_URL ?? "").replace(/\/+$/, "");
const IDX_USER = import.meta.env.VITE_WAZUH_INDEXER_USER ?? "";

if (typeof window === "undefined") {
  if (API_URL.startsWith("/")) API_URL = "http://127.0.0.1:8081" + API_URL;
  if (IDX_URL.startsWith("/")) IDX_URL = "http://127.0.0.1:8081" + IDX_URL;
}

export const WAZUH_API_CONFIGURED = Boolean(API_URL && API_USER);
export const WAZUH_INDEXER_CONFIGURED = Boolean(IDX_URL && IDX_USER);
export const WAZUH_MANAGER_URL = API_URL || "not configured";

console.log("Wazuh API Configured:", WAZUH_API_CONFIGURED, API_URL);

function wazuhSeverity(level: number): Severity {
  if (level >= 14) return "critical";
  if (level >= 12) return "high";
  if (level >= 7) return "medium";
  return "low";
}

// -- Wazuh Manager API (JWT) ---------------------------------------------

let jwtPromise: Promise<string> | null = null;
let jwtExpires = 0;

async function getJwt(): Promise<string> {
  if (jwtPromise && Date.now() < jwtExpires) return jwtPromise;
  jwtPromise = (async () => {
    const r = await fetch(`${API_URL}/security/user/authenticate?raw=true`, {
      method: "POST",
      // Authorization header is now securely injected by the Node.js reverse proxy
    });
    if (!r.ok) throw new Error(`Wazuh auth failed (${r.status})`);
    const text = await r.text();
    // raw=true returns the token as plain text; otherwise JSON.
    if (text.startsWith("{")) {
      const j = JSON.parse(text) as { data?: { token?: string } };
      return j.data?.token ?? "";
    }
    return text.trim();
  })().catch((e) => {
    jwtPromise = null;
    throw e;
  });
  jwtExpires = Date.now() + 14 * 60 * 1000; // tokens default to 15 min
  return jwtPromise;
}

async function apiGet<T>(path: string): Promise<T> {
  const jwt = await getJwt();
  const r = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!r.ok) throw new Error(`Wazuh API ${path} → ${r.status}`);
  return (await r.json()) as T;
}


interface WzAgentItem {
  id: string;
  name: string;
  ip?: string;
  status?: string;
  version?: string;
  dateAdd?: string;
  lastKeepAlive?: string;
  os?: { platform?: string; name?: string; version?: string };
}

function mapAgent(it: WzAgentItem): Agent {
  const status: Agent["status"] =
    it.status === "active"
      ? "active"
      : it.status === "disconnected"
        ? "disconnected"
        : "pending";
  return {
    id: it.id,
    name: it.name,
    ip: it.ip ?? "—",
    os: {
      platform: it.os?.platform ?? "",
      name: it.os?.name ?? "Unknown",
      version: it.os?.version ?? "",
    },
    status,
    version: it.version ?? "",
    lastKeepAlive: it.lastKeepAlive ?? new Date(0).toISOString(),
    registeredAt: it.dateAdd ?? new Date(0).toISOString(),
  };
}

/** GET /agents */
export async function getAgents(): Promise<Agent[]> {
  if (!WAZUH_API_CONFIGURED) throw new Error("Wazuh API is not configured");
  const d = await apiGet<{ data: { affected_items: WzAgentItem[] } }>(
    "/agents?pretty=true",
  );
  return d.data.affected_items.map(mapAgent);
}

/** GET /agents/{agent_id} */
export async function getAgentStatus(id: string): Promise<Agent | undefined> {
  if (!WAZUH_API_CONFIGURED) return MOCK_AGENTS.find((a) => a.id === id);
  const d = await apiGet<{ data: { affected_items: WzAgentItem[] } }>(
    `/agents?agents_list=${encodeURIComponent(id)}`,
  );
  const item = d.data.affected_items[0];
  return item ? mapAgent(item) : undefined;
}

// -- Wazuh Indexer (alerts) ----------------------------------------------

interface WzAlertHit {
  _id: string;
  _source: {
    "@timestamp"?: string;
    timestamp?: string;
    agent?: { id?: string; name?: string };
    rule?: {
      id?: string | number;
      level?: number;
      description?: string;
      groups?: string[];
      mitre?: { id?: string[]; technique?: string[]; tactic?: string[] };
    };
    data?: { srcip?: string; [key: string]: any };
    full_log?: string;
    decoder?: { name?: string };
    location?: string;
  };
}

function mapHit(h: WzAlertHit): Alert {
  const s = h._source;
  const level = s.rule?.level ?? 0;
  return {
    id: h._id,
    timestamp: s["@timestamp"] ?? s.timestamp ?? new Date().toISOString(),
    agent: { id: s.agent?.id ?? "000", name: s.agent?.name ?? "unknown" },
    rule: {
      id: Number(s.rule?.id ?? 0),
      level,
      description: s.rule?.description ?? "(no description)",
      groups: s.rule?.groups ?? [],
    },
    severity: wazuhSeverity(level),
    mitre: {
      technique_id: s.rule?.mitre?.id?.[0] ?? "—",
      technique_name: s.rule?.mitre?.technique?.[0] ?? "—",
      tactic: s.rule?.mitre?.tactic?.[0] ?? "Unknown",
    },
    source_ip: s.data?.srcip,
    full_log: s.full_log || (s.data ? JSON.stringify(s.data, null, 2) : "(No raw log provided)"),
    decoder: s.decoder?.name,
    location: s.location,
  };
}

async function indexerSearch(body: unknown): Promise<WzAlertHit[]> {
  if (!WAZUH_INDEXER_CONFIGURED) return [];
  const r = await fetch(`${IDX_URL}/wazuh-alerts-*/_search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Authorization header is securely injected by the reverse proxy
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Wazuh indexer search → ${r.status}`);
  const d = (await r.json()) as { hits?: { hits?: WzAlertHit[] } };
  return d.hits?.hits ?? [];
}

/** Convenience: most recent alerts (last 7 days, up to 1000). */
export async function getAllAlerts(): Promise<Alert[]> {
  if (!WAZUH_INDEXER_CONFIGURED) throw new Error("Wazuh Indexer is not configured");
  const hits = await indexerSearch({
    size: 1000,
    sort: [{ "@timestamp": { order: "desc" } }],
    query: { 
      bool: {
        must: [{ range: { "@timestamp": { gte: "now-7d/d" } } }],
        must_not: [{ match: { "rule.id": "40704" } }]
      }
    },
  });
  return hits.map(mapHit);
}

/** Filtered alert query — currently filters client-side over the 7d window. */
export async function getAlerts(filters: AlertFilters = {}): Promise<{
  alerts: Alert[];
  total: number;
}> {
  let list = await getAllAlerts();
  if (filters.severity?.length) {
    const set = new Set(filters.severity);
    list = list.filter((a) => set.has(a.severity));
  }
  if (filters.agentIds?.length) {
    const set = new Set(filters.agentIds);
    list = list.filter((a) => set.has(a.agent.id));
  }
  if (filters.tactics?.length) {
    const set = new Set(filters.tactics);
    list = list.filter((a) => set.has(a.mitre.tactic));
  }
  if (filters.from) {
    const f = +new Date(filters.from);
    list = list.filter((a) => +new Date(a.timestamp) >= f);
  }
  if (filters.to) {
    const t = +new Date(filters.to);
    list = list.filter((a) => +new Date(a.timestamp) <= t);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter((a) =>
      [a.rule.description, a.agent.name, a.mitre.technique_id, a.mitre.technique_name, a.source_ip ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  const total = list.length;
  if (filters.page !== undefined && filters.pageSize) {
    const start = filters.page * filters.pageSize;
    list = list.slice(start, start + filters.pageSize);
  }
  return { alerts: list, total };
}

export async function getAlertById(id: string): Promise<Alert | undefined> {
  const all = await getAllAlerts();
  return all.find((a) => a.id === id);
}

// -- Static reference data -----------------------------------------------

export const MITRE_TACTICS = [
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Collection",
  "Command and Control",
  "Exfiltration",
  "Impact",
];

// -- Attack chain reconstruction (derived per-alert, no server call) -----

export interface AttackStep {
  index: number;
  tactic: string;
  technique_id?: string;
  technique_name?: string;
  title: string;
  detail: string;
  indicator?: string;
  status: "observed" | "inferred";
}

export interface AttackChain {
  source: { label: string; ip?: string };
  hop: { label: string; detail: string };
  target: { label: string; host: string; os: string };
  process: { label: string; detail: string };
  steps: AttackStep[];
}

const TACTIC_PREDECESSORS: Record<string, string[]> = {
  "Initial Access": ["Reconnaissance"],
  Execution: ["Initial Access"],
  Persistence: ["Initial Access", "Execution"],
  "Privilege Escalation": ["Initial Access", "Execution"],
  "Defense Evasion": ["Initial Access", "Execution"],
  "Credential Access": ["Initial Access", "Execution"],
  Discovery: ["Initial Access", "Execution"],
  "Lateral Movement": ["Initial Access", "Execution", "Discovery"],
  Collection: ["Initial Access", "Execution", "Discovery"],
  "Command and Control": ["Initial Access", "Execution"],
  Exfiltration: ["Initial Access", "Execution", "Collection", "Command and Control"],
  Impact: ["Initial Access", "Execution", "Defense Evasion"],
};

const TACTIC_TEMPLATE: Record<
  string,
  { title: string; detail: (ctx: { ip?: string; agent: string }) => string }
> = {
  Reconnaissance: {
    title: "External scan of exposed services",
    detail: (c) => `Port/service probe from ${c.ip ?? "unknown source"} targeting ${c.agent}.`,
  },
  "Initial Access": {
    title: "Foothold established on endpoint",
    detail: (c) => `Inbound session accepted from ${c.ip ?? "external host"} on ${c.agent}.`,
  },
  Execution: {
    title: "Adversary code executed on host",
    detail: (c) => `Payload spawned on ${c.agent}.`,
  },
  Persistence: {
    title: "Persistence mechanism planted",
    detail: (c) => `Autorun primitive installed on ${c.agent} to survive reboot.`,
  },
  "Privilege Escalation": {
    title: "Elevated privileges obtained",
    detail: (c) => `Attacker escalated to SYSTEM/root on ${c.agent}.`,
  },
  "Defense Evasion": {
    title: "Defensive controls bypassed",
    detail: (c) => `Obfuscation / log tampering observed on ${c.agent}.`,
  },
  "Credential Access": {
    title: "Credential material accessed",
    detail: (c) => `Secret store read on ${c.agent}.`,
  },
  Discovery: {
    title: "Host and network enumerated",
    detail: (c) => `System, user and network discovery commands run on ${c.agent}.`,
  },
  "Lateral Movement": {
    title: "Pivot toward adjacent host",
    detail: (c) => `Remote service used from ${c.agent} to reach internal targets.`,
  },
  Collection: {
    title: "Sensitive data staged",
    detail: (c) => `Files of interest gathered on ${c.agent}.`,
  },
  "Command and Control": {
    title: "Beacon to external infrastructure",
    detail: (c) => `Outbound channel opened from ${c.agent} to ${c.ip ?? "C2 endpoint"}.`,
  },
  Exfiltration: {
    title: "Data exfiltrated over C2 channel",
    detail: (c) => `Encoded transfer from ${c.agent} to ${c.ip ?? "external endpoint"}.`,
  },
  Impact: {
    title: "Destructive action on assets",
    detail: (c) => `Resource modification/encryption observed on ${c.agent}.`,
  },
};

function processLabel(alert: Alert): { label: string; detail: string } {
  const platform = alert.agent.name.toLowerCase().includes("windows") ? "windows" : "linux";
  const decoder = alert.decoder ?? "";
  if (alert.rule.groups.includes("powershell")) return { label: "powershell.exe", detail: "Script-block 4104" };
  if (decoder === "sysmon") return { label: "sysmon.exe", detail: "EventID 1/8/10/13" };
  if (alert.rule.groups.includes("sshd")) return { label: "sshd", detail: "auth.log" };
  if (alert.rule.groups.includes("auditd")) return { label: "auditd", detail: "syscall trace" };
  return { label: platform === "windows" ? "cmd.exe" : "/bin/bash", detail: alert.location ?? "host log" };
}

export function getAttackChain(alert: Alert): AttackChain {
  const ctx = { ip: alert.source_ip, agent: alert.agent.name };
  const predecessors = TACTIC_PREDECESSORS[alert.mitre.tactic] ?? ["Initial Access", "Execution"];
  const steps: AttackStep[] = predecessors.map((tactic, i) => {
    const tpl = TACTIC_TEMPLATE[tactic] ?? {
      title: tactic,
      detail: () => `Activity attributed to ${tactic} stage.`,
    };
    return {
      index: i + 1,
      tactic,
      title: tpl.title,
      detail: tpl.detail(ctx),
      status: "inferred",
    };
  });
  steps.push({
    index: steps.length + 1,
    tactic: alert.mitre.tactic,
    technique_id: alert.mitre.technique_id,
    technique_name: alert.mitre.technique_name,
    title: alert.rule.description,
    detail: `Wazuh rule ${alert.rule.id} (level ${alert.rule.level}) fired on ${alert.agent.name}.`,
    indicator: alert.full_log.length > 140 ? alert.full_log.slice(0, 137) + "…" : alert.full_log,
    status: "observed",
  });
  return {
    source: { label: alert.source_ip ? "External attacker" : "Local actor", ip: alert.source_ip },
    hop: { label: "Network edge", detail: alert.source_ip ? "Internet → VPC" : "Loopback" },
    target: { label: alert.agent.name, host: alert.agent.name, os: "endpoint" },
    process: processLabel(alert),
    steps,
  };
}

export const TACTIC_COLOR: Record<string, string> = {
  Reconnaissance: "#64748b",
  "Resource Development": "#64748b",
  "Initial Access": "#0ea5e9",
  Execution: "#22d3ee",
  Persistence: "#a855f7",
  "Privilege Escalation": "#f97316",
  "Defense Evasion": "#eab308",
  "Credential Access": "#ec4899",
  Discovery: "#14b8a6",
  "Lateral Movement": "#8b5cf6",
  Collection: "#06b6d4",
  "Command and Control": "#f59e0b",
  Exfiltration: "#f43f5e",
  Impact: "#ef4444",
};

export const SEVERITY_META: Record<
  Severity,
  { label: string; colorVar: string; badgeClass: string }
> = {
  critical: {
    label: "Critical",
    colorVar: "var(--severity-critical)",
    badgeClass: "bg-[var(--severity-critical)]/15 text-[var(--severity-critical)] border-[var(--severity-critical)]/40",
  },
  high: {
    label: "High",
    colorVar: "var(--severity-high)",
    badgeClass: "bg-[var(--severity-high)]/15 text-[var(--severity-high)] border-[var(--severity-high)]/40",
  },
  medium: {
    label: "Medium",
    colorVar: "var(--severity-medium)",
    badgeClass: "bg-[var(--severity-medium)]/15 text-[var(--severity-medium)] border-[var(--severity-medium)]/40",
  },
  low: {
    label: "Low",
    colorVar: "var(--severity-low)",
    badgeClass: "bg-[var(--severity-low)]/15 text-[var(--severity-low)] border-[var(--severity-low)]/40",
  },
};