# SentinelView: Custom Wazuh SIEM Dashboard & Agent Integration 🛡️

SentinelView is a custom-built Security Information and Event Management (SIEM) dashboard powered by React, Vite, and the Wazuh API. This project demonstrates the complete end-to-end deployment of a Wazuh Manager on AWS, the integration of Windows and Linux endpoints, and the execution and detection of MITRE ATT&CK techniques.

## 🏗️ Architecture Overview

The project is split into three main components:
1. **The Server Layer:** An AWS EC2 Instance running the Wazuh Central Manager and Wazuh Indexer.
2. **The Endpoints Layer:** Virtual machines (Ubuntu & Windows 11) running the Wazuh Agent to collect system logs and Sysmon events.
3. **The Presentation Layer:** **SentinelView**, a custom local React dashboard that securely proxies into the Wazuh API to visualize threats in real-time.

---

## 🚀 Phase 1: Server Deployment (AWS EC2)

The Wazuh Manager was deployed on a dedicated AWS EC2 `t3.medium` instance. 

1. **Provisioning:** An Elastic IP (`54.83.241.104`) was attached to ensure a static routing address for the agents.
2. **Installation:** We utilized the Wazuh Quickstart deployment script to spin up the Wazuh Indexer, Manager, and Dashboard.
   ```bash
   curl -sO https://packages.wazuh.com/4.7/wazuh-install.sh && sudo bash ./wazuh-install.sh -a
   ```
3. **API Access:** Passwords for the API (`wazuh-wui`) and Indexer (`admin`) were securely extracted from `wazuh-passwords.txt` and integrated into the SentinelView `.env.local` configuration.

---

## 💻 Phase 2: Building SentinelView (Custom GUI)

To provide a sleek, modern, and focused view of our security posture, we built a custom frontend.

- **Tech Stack:** React, TypeScript, Vite, Tailwind CSS, TanStack Query.
- **Proxy Configuration:** Vite was configured to proxy API requests to bypass CORS restrictions while maintaining strict security.
- **Features:** 
  - Real-time Agent Monitoring (Active/Disconnected states, OS mapping).
  - Live Alert Feed with Severity mapping.
  - Interactive MITRE ATT&CK coverage matrix.
  - PDF & CSV Export functionality for compliance reporting.

---

## 🔗 Phase 3: Agent Deployment & Configuration

We connected two distinct endpoints to simulate a diverse network environment.

### 🐧 1. Linux Endpoint (Ubuntu)
- Installed the Wazuh Agent via APT.
- Configured `/var/ossec/etc/ossec.conf` to point to the AWS Elastic IP.
- Ensured SSH auth logs were being actively monitored for brute-force attempts.

### 🪟 2. Windows Endpoint (Windows 11)
- Installed the Wazuh Agent via MSI silently.
- **Crucial Step:** Deployed Sysmon with SwiftOnSecurity's configuration to enable deep process-level logging.
- Modified the Wazuh Agent `ossec.conf` to ingest Sysmon logs:
  ```xml
  <localfile>
    <location>Microsoft-Windows-Sysmon/Operational</location>
    <log_format>eventchannel</log_format>
  </localfile>
  ```

---

## ⚔️ Phase 4: Threat Simulation (MITRE ATT&CK)

To prove the efficacy of the SIEM, we executed live attacks against the endpoints and successfully captured the resulting alerts in SentinelView.

### Attack 1: Malicious PowerShell Execution (Windows)
- **Technique:** `T1059.001 - Command and Scripting Interpreter: PowerShell`
- **Execution:** We utilized **Atomic Red Team** to execute obfuscated PowerShell payloads.
- **Detection:** Sysmon Event ID 1 caught the execution, and Wazuh successfully mapped it to the MITRE framework as a High severity alert.

### Attack 2: Credential Dumping (Windows)
- **Technique:** `T1003.001 - OS Credential Dumping: LSASS Memory`
- **Execution:** Atomic Red Team simulated dumping the LSASS process using Procdump.
- **Detection:** The Wazuh Manager caught the suspicious process access attempt (Critical Severity).

### Attack 3: SSH Brute Force (Linux)
- **Technique:** `T1110.001 - Brute Force: Password Guessing`
- **Execution:** We used `hydra` to flood the Ubuntu VM with SSH login attempts.
- **Detection:** The Wazuh decoders parsed the rapid failure logs, triggering Rule 5716 (SSHD brute force trying to get access).

### Attack 4: Account Creation (Linux)
- **Technique:** `T1136.001 - Create Account: Local Account`
- **Execution:** Created a rogue persistence account using `useradd`.
- **Detection:** System logs immediately fired an alert for new user account creation.

---

## 🧹 Phase 5: Tuning & Noise Reduction

A critical part of any SIEM deployment is tuning the ruleset to prevent alert fatigue.
- We noticed the Wazuh Manager was spamming Rule `40704` (Systemd Service failures) due to an intentional dashboard shutdown.
- We tuned the Indexer by clearing out the spam alerts and filtering them at the API layer to ensure SentinelView only displays actionable, high-fidelity security events.

---

## 👥 Team Roles & Responsibilities

This project was a collaborative effort, with the architecture securely partitioned into specialized roles:

### 👑 Team Lead & Architect (You)
- **Infrastructure:** Provisioned the AWS EC2 instance, managed the Elastic IP routing, and deployed the Wazuh Central Manager & Indexer.
- **Frontend Engineering:** Designed and built the custom **SentinelView** React dashboard from scratch.
- **Integration:** Handled API authentication, CORS proxy configuration, and Server-Side Rendering (SSR) bypasses.
- **SIEM Tuning:** Purged 14,000+ noisy Systemd alerts from the Indexer and optimized the dashboard feed.

### 🐧 Linux Security Engineer (Youssef)
- **Endpoint Setup:** Provisioned and secured the Ubuntu Virtual Machine.
- **Agent Integration:** Installed the Wazuh Agent and established a secure connection to the AWS Manager.
- **Threat Simulation:** Acted as the Red Team by successfully executing Linux-based attacks:
  - Simulated `T1110.001` (SSH Brute Force) using Hydra.
  - Simulated `T1136.001` (Persistence) by creating rogue system accounts.

### 🪟 Windows Security Engineer (Masoud)
- **Endpoint Setup:** Provisioned the Windows 11 Virtual Machine.
- **Deep Visibility:** Successfully deployed and configured **Sysmon** alongside the Wazuh Agent to capture deep process-level telemetry.
- **Threat Simulation:** Executed advanced Windows-based attacks using **Atomic Red Team**:
  - Simulated `T1059.001` (Execution) using obfuscated PowerShell payloads.
  - Simulated `T1003.001` (Credential Access) by dumping LSASS memory via Procdump.

---

## 🏁 Conclusion

This project successfully demonstrates a full-circle security operation: from infrastructure deployment and log ingestion to custom data visualization and live threat detection. SentinelView acts as the perfect lightweight lens into the power of the Wazuh engine.
