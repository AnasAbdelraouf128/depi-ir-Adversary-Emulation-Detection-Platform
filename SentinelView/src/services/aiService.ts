/**
 * AI service layer — local-first SOC analyst assistant.
 *
 * Powered by Qwen2.5 14B running locally via Ollama (default endpoint
 * http://localhost:11434). No telemetry, no cloud calls — all inference
 * happens on the analyst's machine.
 *
 * Mirrors the swappable pattern used in `wazuhApi.ts`:
 *   - USE_MOCK = true  → returns deterministic canned responses so the UI
 *                        works without Ollama installed (demo/build mode).
 *   - USE_MOCK = false → POSTs to `${OLLAMA_HOST}/api/chat`.
 *
 * Toggle with VITE_AI_USE_MOCK / VITE_OLLAMA_HOST / VITE_AI_MODEL.
 */

import type { Alert, Severity } from "./wazuhApi";

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export const USE_MOCK_AI =
  (env.VITE_AI_USE_MOCK ?? "true").toLowerCase() !== "false";
export const OLLAMA_HOST = env.VITE_OLLAMA_HOST ?? "http://localhost:11434";
export const AI_MODEL = env.VITE_AI_MODEL ?? "qwen2.5:14b";
export const AI_MODE: "mock" | "ollama" = USE_MOCK_AI ? "mock" : "ollama";

// -- Types ---------------------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TriageReport {
  summary: string;
  severity: Severity;
  severity_rationale: string;
  severity_confidence: number; // 0..1
  wazuh_severity: Severity;
  mitre: { id: string; name: string; tactic: string };
  recommendation: string;
  indicators: string[];
}

export interface DailyBriefing {
  headline: string;
  trends: string[];
  topIncidents: string[];
  recommendations: string[];
  generatedAt: string;
  windowHours: number;
}

// -- Ollama transport ----------------------------------------------------

async function ollamaChat(messages: ChatMessage[], opts?: { json?: boolean }): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      stream: false,
      format: opts?.json ? "json" : undefined,
      options: { temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

// -- 1. Automated Alert Translation & Triage -----------------------------

const PLAIN_RULE_MAP: Record<string, string> = {
  T1059: "an attacker ran commands directly on the machine",
  "T1059.001": "an attacker executed a hidden PowerShell command",
  "T1059.003": "an attacker spawned a Windows command shell, often from an Office document",
  "T1059.004": "an attacker executed a Unix shell command",
  T1055: "malicious code was injected into a legitimate running process to hide",
  "T1003.001": "credentials were dumped directly from the LSASS process — classic Mimikatz behaviour",
  "T1003.008": "the system password files /etc/passwd and /etc/shadow were accessed",
  "T1071.001": "the host beaconed out over HTTP/HTTPS to a suspicious destination",
  "T1547.001": "a registry Run key was added so malware survives reboot",
  "T1053.003": "a cron job was created so the attacker keeps a foothold",
  "T1053.005": "a scheduled task was created to keep an attacker foothold",
  "T1548.003": "sudo was abused to escalate privileges",
  T1134: "an access token was stolen or manipulated to act as another user",
  T1082: "the attacker queried basic system information for reconnaissance",
  T1083: "the attacker enumerated files and directories looking for valuable data",
  T1016: "the attacker examined the network configuration",
  "T1070.004": "log or evidence files were deleted to cover tracks",
  T1027: "the payload was obfuscated or encoded to evade detection",
  T1105: "a new binary or tool was downloaded onto the host",
  T1486: "files were mass-encrypted — strong indicator of ransomware",
  "T1110.001": "many password guesses were attempted against an account",
  T1531: "an attacker repeatedly failed to authenticate, indicating a brute-force, account access removal, or password spraying attempt",
};

const RECOMMENDATION_MAP: Record<Severity, (a: Alert) => string> = {
  critical: (a) =>
    `Isolate ${a.agent.name} from the network immediately, kill the offending process, and start incident-response triage. Preserve memory and disk artefacts for forensics.`,
  high: (a) =>
    `Investigate ${a.agent.name} within the hour. Confirm the source process is expected; if not, contain the host${a.source_ip ? ` and block ${a.source_ip} at the edge firewall` : ""}.`,
  medium: (a) =>
    `Add ${a.agent.name} to today's review queue${a.source_ip ? ` and add ${a.source_ip} to the watchlist` : ""}. Correlate against other recent alerts before escalating.`,
  low: () =>
    "Document and continue monitoring. No immediate action required unless this fires repeatedly.",
};

function extractIndicators(a: Alert): string[] {
  const ind: string[] = [];
  if (a.source_ip) ind.push(`source IP ${a.source_ip}`);
  ind.push(`rule ${a.rule.id} (level ${a.rule.level})`);
  ind.push(`MITRE ${a.mitre.technique_id} · ${a.mitre.tactic}`);
  if (a.location) ind.push(`source ${a.location}`);
  return ind;
}

// -- Independent AI severity classifier ---------------------------------
//
// The Wazuh rule engine assigns a level (0-15). The AI classifier looks
// at the *behaviour* (MITRE technique, tactic, indicators, log content)
// and decides severity on its own — it does NOT just echo the rule level.
// This lets the analyst spot cases where the AI disagrees with Wazuh.

const TECHNIQUE_RISK: Record<string, number> = {
  // Critical impact / credential theft / ransomware
  T1486: 95, // Data Encrypted for Impact (ransomware)
  T1485: 90, // Data Destruction
  T1490: 85, // Inhibit System Recovery
  "T1003.001": 92, // LSASS dump (Mimikatz)
  "T1003.008": 80, // /etc/shadow access
  T1003: 85,
  // Execution / injection
  T1055: 78, // Process injection
  "T1059.001": 85, // PowerShell
  "T1059.003": 85, // cmd.exe
  "T1059.004": 85, // Unix shell
  T1059: 85,
  // Persistence / privilege escalation
  "T1547.001": 72, // Run keys
  "T1053.005": 70, // Scheduled task
  "T1053.003": 68, // cron
  "T1548.003": 85, // sudo abuse
  "T1136.001": 85, // local account creation
  T1136: 85,
  T1134: 72, // Token manipulation
  // Defense evasion
  "T1070.004": 60, // File deletion
  T1027: 85, // Obfuscation
  // C2 / lateral
  "T1071.001": 70, // Web C2
  T1105: 85, // Ingress tool transfer
  // Discovery (low impact on its own)
  T1082: 30,
  T1083: 28,
  T1016: 25,
  // Brute force
  "T1110.001": 60,
  T1531: 95, // Account Access Removal / Logon Failure
};

const TACTIC_WEIGHT: Record<string, number> = {
  Impact: 25,
  "Credential Access": 20,
  "Privilege Escalation": 15,
  "Initial Access": 15,
  "Lateral Movement": 12,
  "Command and Control": 12,
  Persistence: 10,
  Execution: 8,
  "Defense Evasion": 8,
  Discovery: 2,
  Reconnaissance: 2,
};

function scoreToSeverity(score: number): Severity {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

const SEV_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

function classifySeverity(alert: Alert): {
  severity: Severity;
  rationale: string;
  confidence: number;
} {
  const tid = alert.mitre.technique_id;
  const root = tid.split(".")[0];
  const techScore = TECHNIQUE_RISK[tid] ?? TECHNIQUE_RISK[root] ?? 40;
  const tacticScore = TACTIC_WEIGHT[alert.mitre.tactic] ?? 5;
  const ruleScore = Math.min(alert.rule.level, 15) * 3; // 0..45

  const log = (alert.full_log ?? "").toLowerCase();
  let contextBonus = 0;
  const contextHits: string[] = [];
  if (/mimikatz|lsass|sekurlsa/.test(log)) {
    contextBonus += 15;
    contextHits.push("credential-dumping toolmarks in log");
  }
  if (/ransom|\.locked|encrypt(ed)? files/.test(log)) {
    contextBonus += 20;
    contextHits.push("ransomware language in log");
  }
  if (/powershell.*-(enc|e |encodedcommand)/.test(log)) {
    contextBonus += 8;
    contextHits.push("encoded PowerShell payload");
  }
  if (alert.source_ip && !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(alert.source_ip)) {
    contextBonus += 5;
    contextHits.push("external source IP");
  }

  const raw = techScore * 0.55 + tacticScore + ruleScore * 0.5 + contextBonus;
  const score = Math.max(0, Math.min(100, raw));
  const severity = scoreToSeverity(score);

  const parts = [
    `MITRE ${tid} risk ${techScore}/100`,
    `${alert.mitre.tactic} tactic weight +${tacticScore}`,
    `Wazuh rule level ${alert.rule.level}`,
  ];
  if (contextHits.length) parts.push(contextHits.join("; "));
  const rationale = `${parts.join(" · ")} → composite ${Math.round(score)}/100.`;

  // Confidence: higher when technique is in our catalog and signals agree.
  const known = TECHNIQUE_RISK[tid] !== undefined || TECHNIQUE_RISK[root] !== undefined;
  const agreement = 1 - Math.abs(SEV_RANK[severity] - SEV_RANK[alert.severity]) / 3;
  const confidence = Math.min(0.98, 0.55 + (known ? 0.2 : 0) + agreement * 0.2 + contextHits.length * 0.03);

  return { severity, rationale, confidence };
}

export function isTruePositive(alert: Alert): boolean {
  // If Wazuh already flags it as high/critical, it's a true positive worth investigating
  if (alert.severity === "critical" || alert.severity === "high") return true;
  
  // Use our AI heuristic engine for medium/low alerts
  const cls = classifySeverity(alert);
  
  // Only promote alerts to True Positives if they are AT LEAST a low/medium severity (level 3+) in Wazuh originally.
  // This prevents extremely noisy level 0-2 rules from being promoted just because they map to a dangerous MITRE technique.
  if (alert.rule.level < 3) return false;

  // If the heuristic promotes it to high/critical, flag it
  if (cls.severity === "critical" || cls.severity === "high") return true;
  
  // If we have extremely high confidence it's an attack
  if (cls.confidence > 0.85) return true;
  
  return false;
}

function mockTriage(alert: Alert): TriageReport {
  const base = alert.mitre.technique_id;
  const root = base.split(".")[0];
  const plain =
    PLAIN_RULE_MAP[base] ??
    PLAIN_RULE_MAP[root] ??
    `behaviour matching ${alert.mitre.technique_name} was observed`;
  const cls = classifySeverity(alert);
  const summary =
    `On ${alert.agent.name}, ${plain}. Wazuh rule ${alert.rule.id} ` +
    `("${alert.rule.description}") fired at level ${alert.rule.level}, mapped to ` +
    `MITRE ${alert.mitre.technique_id} (${alert.mitre.tactic}).`;
  return {
    summary,
    severity: cls.severity,
    severity_rationale: cls.rationale,
    severity_confidence: cls.confidence,
    wazuh_severity: alert.severity,
    mitre: {
      id: alert.mitre.technique_id,
      name: alert.mitre.technique_name,
      tactic: alert.mitre.tactic,
    },
    recommendation: RECOMMENDATION_MAP[cls.severity](alert),
    indicators: extractIndicators(alert),
  };
}

export async function translateAlert(alert: Alert): Promise<TriageReport> {
  if (USE_MOCK_AI) {
    // simulate model latency for realism
    await new Promise((r) => setTimeout(r, 600));
    return mockTriage(alert);
  }
  const sys: ChatMessage = {
    role: "system",
    content:
      "You are a senior SOC analyst. Translate raw Wazuh alerts into plain English AND independently classify severity based on attacker behaviour (MITRE technique, tactic, indicators, log content) — do NOT just copy the Wazuh rule level. Reply strictly as JSON with keys: summary, severity (critical|high|medium|low), severity_rationale (1-2 sentences explaining your classification), severity_confidence (0..1), mitre {id,name,tactic}, recommendation, indicators (string array).",
  };
  const user: ChatMessage = {
    role: "user",
    content: JSON.stringify({
      rule: alert.rule,
      mitre: alert.mitre,
      agent: alert.agent,
      source_ip: alert.source_ip,
      full_log: alert.full_log,
      wazuh_severity: alert.severity,
    }),
  };
  const raw = await ollamaChat([sys, user], { json: true });
  try {
    const parsed = JSON.parse(raw) as Partial<TriageReport>;
    return {
      ...mockTriage(alert),
      ...parsed,
      wazuh_severity: alert.severity,
    } as TriageReport;
  } catch {
    return mockTriage(alert);
  }
}

// -- 2. Executive Daily Security Briefing --------------------------------

function mockBriefing(alerts: Alert[], windowHours: number): DailyBriefing {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byAgent: Record<string, number> = {};
  const byTactic: Record<string, number> = {};
  const byRule: Record<string, { description: string; count: number; severity: Severity }> = {};
  for (const a of alerts) {
    counts[a.severity]++;
    byAgent[a.agent.name] = (byAgent[a.agent.name] ?? 0) + 1;
    byTactic[a.mitre.tactic] = (byTactic[a.mitre.tactic] ?? 0) + 1;
    const k = String(a.rule.id);
    if (!byRule[k]) byRule[k] = { description: a.rule.description, count: 0, severity: a.severity };
    byRule[k].count++;
  }

  const topRules = Object.values(byRule).sort((a, b) => b.count - a.count).slice(0, 3);
  const topTactic = Object.entries(byTactic).sort((a, b) => b[1] - a[1])[0];
  const noisiestAgent = Object.entries(byAgent).sort((a, b) => b[1] - a[1])[0];

  const headline =
    counts.critical > 0
      ? `${counts.critical} critical incident${counts.critical === 1 ? "" : "s"} in the last ${windowHours}h — immediate review required.`
      : counts.high > 0
        ? `Elevated activity: ${counts.high} high-severity alerts in the last ${windowHours}h.`
        : `Routine activity over the last ${windowHours}h — ${alerts.length} alerts, none critical.`;

  const trends: string[] = [];
  if (topTactic)
    trends.push(
      `${topTactic[1]} alerts mapped to MITRE tactic "${topTactic[0]}" — the dominant attacker behaviour this window.`,
    );
  if (noisiestAgent)
    trends.push(
      `${noisiestAgent[0]} generated ${noisiestAgent[1]} alerts (${Math.round((noisiestAgent[1] / Math.max(1, alerts.length)) * 100)}% of volume).`,
    );
  const bruteForce = (byRule["5712"]?.count ?? 0) + (byRule["5710"]?.count ?? 0);
  if (bruteForce > 3)
    trends.push(`Spike in SSH brute-force attempts: ${bruteForce} failed-login events recorded.`);

  const topIncidents = topRules.map(
    (r) => `${r.description} — ${r.count}× (${SEVERITY_LABEL[r.severity]})`,
  );

  const recommendations: string[] = [];
  if (counts.critical > 0)
    recommendations.push("Open an incident ticket for each critical alert and verify endpoint isolation.");
  if (bruteForce > 3)
    recommendations.push("Enforce fail2ban / account lockout on Ubuntu hosts and review SSH exposure.");
  if (counts.high > 0)
    recommendations.push("Triage high-severity alerts within the next 4h SLA window.");
  if (recommendations.length === 0)
    recommendations.push("Maintain baseline monitoring. Review weekly trends in the MITRE matrix.");

  return {
    headline,
    trends,
    topIncidents,
    recommendations,
    generatedAt: new Date().toISOString(),
    windowHours,
  };
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export async function generateDailyBriefing(
  alerts: Alert[],
  windowHours = 24,
): Promise<DailyBriefing> {
  const now = Date.now();
  const windowAlerts = alerts.filter(
    (a) => now - +new Date(a.timestamp) <= windowHours * 3600 * 1000,
  );

  if (USE_MOCK_AI) {
    await new Promise((r) => setTimeout(r, 900));
    return mockBriefing(windowAlerts, windowHours);
  }

  const sys: ChatMessage = {
    role: "system",
    content:
      "You are the lead SOC analyst writing the daily executive briefing. Be concise, professional, decision-focused. Reply strictly as JSON with keys: headline, trends (string[]), topIncidents (string[]), recommendations (string[]).",
  };
  const condensed = windowAlerts
    .sort((a, b) => b.rule.level - a.rule.level)
    .slice(0, 20)
    .map((a) => ({
      t: a.timestamp,
      sev: a.severity,
      agent: a.agent.name,
      rule: a.rule.description,
      mitre: a.mitre.technique_id,
      tactic: a.mitre.tactic,
      src: a.source_ip,
    }));
  const user: ChatMessage = {
    role: "user",
    content: `Window: last ${windowHours}h. Alerts:\n${JSON.stringify(condensed)}`,
  };
  const raw = await ollamaChat([sys, user], { json: true });
  try {
    const parsed = JSON.parse(raw) as Omit<DailyBriefing, "generatedAt" | "windowHours">;
    return { ...parsed, generatedAt: new Date().toISOString(), windowHours };
  } catch {
    return mockBriefing(windowAlerts, windowHours);
  }
}

// -- 3. Interactive SOC Assistant Chatbot --------------------------------

const KB: Array<{ match: RegExp; answer: string }> = [
  {
    match: /T1531|logon failure|account access removal/i,
    answer:
      "**MITRE T1531 — Account Access Removal / Logon Failure** occurs when an attacker triggers repeated logon failures or actively attempts to lock out / remove access to an account. Wazuh logs this heavily on Windows as Event ID 4625 (Logon Failure).\n\n**Action:** Verify if this is an expected lockout due to a forgotten password, or if it is part of a brute-force or password spraying campaign (often mapped alongside T1110). If malicious, block the source IP and verify no successful subsequent logons (Event ID 4624) occurred for the targeted account.",
  },
  {
    match: /T1110(\.001)?|brute[\s-]?force|password guess/i,
    answer:
      "**MITRE T1110.001 — Password Guessing** is when an attacker attempts many passwords against a single account, hoping to land on a valid one. In Wazuh this typically surfaces as rule 5712 (\"SSHD brute force\") on Linux or 4625 events on Windows.\n\n**Mitigations:**\n1. Enable fail2ban / account lockout after 5 failed attempts.\n2. Move SSH off port 22 and require key-based auth.\n3. Add the offending IP to an iptables drop list or your edge firewall.",
  },
  {
    match: /T1059(\.001)?|powershell.*encoded|encoded.*powershell/i,
    answer:
      "**MITRE T1059.001 — PowerShell** covers attacker use of PowerShell, frequently with `-EncodedCommand` to hide intent. Wazuh rule 92213 fires on EventID 4104 ScriptBlock logging.\n\n**What to do:** Decode the Base64 payload (`[Convert]::FromBase64String`), check the parent process (often `winword.exe` or `outlook.exe` indicating phishing), and verify Constrained Language Mode is enforced on the endpoint.",
  },
  {
    match: /T1003(\.001)?|lsass|mimikatz|credential dump/i,
    answer:
      "**MITRE T1003.001 — LSASS Memory Dumping** is credential theft from the LSASS process — the Mimikatz pattern. Wazuh rule 92250 catches it via Sysmon EventID 10 with GrantedAccess 0x1410/0x1010.\n\n**Action:** This is critical. Isolate the host, rotate every credential cached on it (especially privileged accounts), enable Credential Guard, and hunt laterally for the same process name elsewhere.",
  },
  {
    match: /T1486|ransomware|encrypted/i,
    answer:
      "**MITRE T1486 — Data Encrypted for Impact** is ransomware behaviour. Wazuh's FIM rule 100270 fires when many files are modified in a short window with a uniform new extension.\n\n**Action:** Disconnect the host immediately — pull the cable. Preserve volume shadow copies. Identify patient zero. Do not pay; restore from clean backups.",
  },
  {
    match: /block.*ip|block.*ssh|firewall.*ip/i,
    answer:
      "On Ubuntu, block an IP at the kernel level with:\n```bash\nsudo iptables -A INPUT -s <IP> -j DROP\nsudo iptables-save | sudo tee /etc/iptables/rules.v4\n```\nFor a more durable approach use **fail2ban** with `sshd` jail, or push the IP into your edge firewall / security group. Wazuh's **active response** can do this automatically — see `/var/ossec/etc/ossec.conf` `<active-response>` blocks.",
  },
  {
    match: /T1055|process injection/i,
    answer:
      "**MITRE T1055 — Process Injection** is when a malicious process writes code into a legitimate process to hide. Detected via Sysmon EventID 8 (CreateRemoteThread) or 10 (ProcessAccess with write permissions).\n\n**Action:** Capture a memory dump of both source and target process, identify the injected module, and add its hash to your blocklist.",
  },
  {
    match: /T1547(\.001)?|persistence|run key|startup/i,
    answer:
      "**MITRE T1547.001 — Registry Run Keys** is a classic persistence technique. The attacker drops a value under `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run` so their payload re-launches at logon.\n\n**Action:** Use Autoruns (Sysinternals) to list every persistence point, delete the malicious entry, and identify the payload it referenced.",
  },
  {
    match: /wazuh.*level|rule level|severity level/i,
    answer:
      "Wazuh assigns a numeric **rule level** from 0–15:\n- **0–6** → Low (informational / noise)\n- **7–11** → Medium (suspicious, worth review)\n- **12–14** → High (likely malicious)\n- **15+** → Critical (compromise indicators, immediate action)\n\nLevels are defined in `/var/ossec/ruleset/rules/*.xml` and can be tuned per environment.",
  },
  {
    match: /atomic red team|atomic-red|art\b/i,
    answer:
      "**Atomic Red Team** is a library of small, MITRE-mapped attack simulations. You invoke a test with `Invoke-AtomicTest T1059.001-1`. Each test produces predictable telemetry — perfect for verifying that your Wazuh rules actually fire. Your two agents (Youssef-Ubuntu, Masoud-Windows11) are running these as the dashboard's primary data source.",
  },
];

function mockAssistant(history: ChatMessage[]): string {
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  for (const k of KB) if (k.match.test(last)) return k.answer;
  return (
    `I can answer questions about MITRE ATT&CK techniques (e.g. *"What is T1003.001?"*), explain Wazuh rule levels, ` +
    `or suggest containment actions (e.g. *"how do I block an IP?"*). Try asking about a specific technique ID or ` +
    `rule you're investigating.\n\n` +
    `_Running in mock mode. Point \`VITE_AI_USE_MOCK=false\` at a local Ollama serving \`${AI_MODEL}\` for full context-aware answers._`
  );
}

export async function chatWithAssistant(history: ChatMessage[]): Promise<string> {
  if (USE_MOCK_AI) {
    await new Promise((r) => setTimeout(r, 500));
    return mockAssistant(history);
  }
  const sys: ChatMessage = {
    role: "system",
    content:
      "You are an embedded SOC assistant inside the SentinelView console. You help analysts understand Wazuh alerts, MITRE ATT&CK techniques, and incident response actions. Be concise, technical, and actionable. Use markdown.",
  };
  return ollamaChat([sys, ...history]);
}