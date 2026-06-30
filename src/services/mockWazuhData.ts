import type { Alert, Agent, MitreMapping, Severity } from "./wazuhApi";

function getSeverity(level: number): Severity {
  if (level >= 14) return "critical";
  if (level >= 12) return "high";
  if (level >= 7) return "medium";
  return "low";
}

export const MOCK_AGENTS: Agent[] = [
  {
    id: "000",
    name: "wazuh-server",
    ip: "127.0.0.1",
    os: { platform: "ubuntu", name: "Ubuntu", version: "22.04.4 LTS" },
    status: "active",
    version: "Wazuh v4.7.3",
    lastKeepAlive: new Date().toISOString(),
    registeredAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "001",
    name: "win-desktop-01",
    ip: "192.168.1.55",
    os: { platform: "windows", name: "Windows 11", version: "10.0.22621" },
    status: "active",
    version: "Wazuh v4.7.3",
    lastKeepAlive: new Date().toISOString(),
    registeredAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: "002",
    name: "win-server-ad",
    ip: "192.168.1.10",
    os: { platform: "windows", name: "Windows Server 2022", version: "10.0.20348" },
    status: "active",
    version: "Wazuh v4.7.3",
    lastKeepAlive: new Date().toISOString(),
    registeredAt: new Date(Date.now() - 40 * 86400000).toISOString(),
  },
  {
    id: "003",
    name: "linux-web-prod",
    ip: "10.0.0.45",
    os: { platform: "ubuntu", name: "Ubuntu", version: "20.04 LTS" },
    status: "disconnected",
    version: "Wazuh v4.7.2",
    lastKeepAlive: new Date(Date.now() - 86400000).toISOString(),
    registeredAt: new Date(Date.now() - 100 * 86400000).toISOString(),
  },
  {
    id: "004",
    name: "mac-dev-01",
    ip: "192.168.1.102",
    os: { platform: "darwin", name: "macOS Sonoma", version: "14.4.1" },
    status: "pending",
    version: "Wazuh v4.7.3",
    lastKeepAlive: new Date().toISOString(),
    registeredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

const MOCK_RULES = [
  { id: 5716, level: 12, description: "SSHD: brute force trying to get access to the system.", mitre: { technique_id: "T1110.001", technique_name: "Password Guessing", tactic: "Credential Access" } },
  { id: 60122, level: 10, description: "Windows: Possible privilege escalation via Token manipulation.", mitre: { technique_id: "T1134", technique_name: "Access Token Manipulation", tactic: "Privilege Escalation" } },
  { id: 100002, level: 14, description: "Malware detection: Emotet signature match.", mitre: { technique_id: "T1059.001", technique_name: "PowerShell", tactic: "Execution" } },
  { id: 5501, level: 5, description: "PAM: Login session opened.", mitre: { technique_id: "T1078", technique_name: "Valid Accounts", tactic: "Initial Access" } },
  { id: 5710, level: 5, description: "SSHD: Attempt to login using a non-existent user.", mitre: { technique_id: "T1110.001", technique_name: "Password Guessing", tactic: "Credential Access" } },
  { id: 92652, level: 8, description: "AWS: CloudTrail misconfiguration detected.", mitre: { technique_id: "T1562.008", technique_name: "Disable or Modify Cloud Trail", tactic: "Defense Evasion" } },
];

export const generateMockAlerts = (count: number): Alert[] => {
  const alerts: Alert[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const agent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
    const ruleDef = MOCK_RULES[Math.floor(Math.random() * MOCK_RULES.length)];
    
    // Distribute time somewhat realistically (more recent)
    const timestamp = new Date(now - Math.floor(Math.random() * Math.random() * 86400000 * 3)).toISOString();
    
    alerts.push({
      id: `mock-${i}-${Date.now()}`,
      timestamp,
      agent: { id: agent.id, name: agent.name },
      rule: {
        id: ruleDef.id,
        level: ruleDef.level,
        description: ruleDef.description,
        groups: ["syslog", "sshd"],
      },
      severity: getSeverity(ruleDef.level),
      mitre: ruleDef.mitre,
      source_ip: "192.168.1." + Math.floor(Math.random() * 255),
      full_log: `${timestamp} ${agent.name} ${ruleDef.description} [Mock Data Log Entry]`,
      decoder: "json",
      location: "/var/log/auth.log"
    });
  }
  
  // Sort descending by time
  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const MOCK_ALERTS = generateMockAlerts(500);
