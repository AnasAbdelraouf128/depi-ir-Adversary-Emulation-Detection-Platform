# SentinelView: Full End-to-End SOC Deployment Documentation

## 1. Project Overview & Team Structure
**Project Name:** SentinelView (Adversary Emulation & Detection Platform)
**Objective:** Deploy a complete Security Information and Event Management (SIEM) pipeline on AWS, execute MITRE ATT&CK adversarial emulations across Linux and Windows endpoints, and visualize the threats in real-time through a custom AI-integrated React dashboard.

### 👥 Team Roles & Responsibilities
- **Hazem & Abdelrahman (Cloud Engineers):** AWS Cloud Infrastructure, EC2 Deployment, Wazuh Stack Configuration, Elastic IP Routing, Port Security.
- **Masoud (Windows Victim):** Windows 11 VM Configuration, Sysmon Integration, Wazuh Agent Deployment, Windows-based MITRE Emulations.
- **Youssef (Linux Victim):** Ubuntu VM Configuration, Wazuh Agent Deployment, Linux-based MITRE Emulations.
- **Adham & Anas (GUI Developers):** Designed, built, and tested the custom React dashboard (SentinelView) integrating securely with the Wazuh API.
- **Anas (Rules Engineer & AI Developer):** Analyzed Wazuh logs, mapped events to MITRE frameworks, and exclusively designed and integrated the generative AI capabilities into the dashboard to verify and summarize threats.

---

## 2. Phase 1: Cloud Infrastructure Deployment (AWS)
**Owners:** Hazem & Abdelrahman

1. **AWS EC2 Provisioning:**
   - Spun up an AWS `t3.medium` EC2 instance running Ubuntu 22.04.
   - Assigned an **Elastic IP** to guarantee a static route for remote endpoint connections.
2. **Security Groups & Ports:**
   - Configured AWS Security Groups to allow inbound traffic on:
     - `1514` (Agent Enrollment & Logs)
     - `1515` (Agent Registration)
     - `55000` (Wazuh API)
     - `9200` (Wazuh Indexer / Elasticsearch)
3. **Wazuh Stack Installation:**
   - Ran the official Wazuh Quickstart script:
     ```bash
     curl -sO https://packages.wazuh.com/4.7/wazuh-install.sh
     sudo bash ./wazuh-install.sh -a
     ```
   - Verified that the Manager, Indexer, and Filebeat were active and running.

---

## 3. Phase 2: Endpoint Deployment & Telemetry

### 3.1 Windows Endpoint Configuration
**Owner:** Masoud
1. **VM Provisioning:** Configured a local Windows 11 Virtual Machine.
2. **Wazuh Agent Install:** Installed the Wazuh Agent locally using the MSI installer, pointing the agent configuration to the AWS Elastic IP.
3. **Sysmon Integration:**
   - Downloaded Microsoft Sysinternals Sysmon.
   - Applied the advanced `SwiftOnSecurity` sysmon configuration file to capture granular process creations, network connections, and memory dumps.
   - Modified `ossec.conf` on the Windows agent to stream the `Microsoft-Windows-Sysmon/Operational` event channel directly to the AWS Wazuh Manager.

### 3.2 Linux Endpoint Configuration
**Owner:** Youssef
1. **VM Provisioning:** Configured a local Ubuntu Virtual Machine.
2. **Wazuh Agent Install:** 
   - Installed the Wazuh agent via APT repository.
   - Bound the agent to the AWS Elastic IP in `/var/ossec/etc/ossec.conf`.
3. **Auditd Setup:** Enabled `auditd` on the Ubuntu machine to track file modifications and shell commands.

---

## 4. Phase 3: Adversary Emulation (MITRE ATT&CK)

### 4.1 Windows Attacks (Masoud)
Using **Atomic Red Team**, Masoud simulated advanced persistent threats on the Windows 11 Endpoint:
1. **T1059.001 (Command and Scripting Interpreter: PowerShell):**
   - Executed heavily obfuscated, Base64-encoded PowerShell payloads to bypass standard anti-virus string matching.
2. **T1003.001 (OS Credential Dumping: LSASS Memory):**
   - Attempted to dump the LSASS process memory using `procdump` and `mimikatz` to simulate credential theft.

### 4.2 Linux Attacks (Youssef)
Using **Atomic Red Team** and custom bash tools, Youssef executed attacks on the Ubuntu Endpoint:
1. **T1110.001 (Brute Force: Password Guessing):**
   - Used `hydra` to launch a high-volume SSH dictionary attack against the Ubuntu machine.
2. **T1136.001 (Create Account: Local Account):**
   - Simulated persistence by illegally provisioning unauthorized local root-level user accounts (`useradd`).

---

## 5. Phase 4: Rules Engineering & Log Analysis
**Owner:** Anas

1. **Log Analysis:** SSH'd into the AWS Wazuh Manager to analyze the incoming raw JSON payloads from Sysmon and Auditd.
2. **Custom Rule Creation:**
   - Navigated to `/var/ossec/etc/rules/local_rules.xml`.
   - Built custom detection logic to flag Masoud's specific PowerShell obfuscations and LSASS access.
   - Tuned existing rules to accurately flag Youssef's SSH brute force without creating false positives for normal administrative logins.
3. **MITRE Mapping:** Mapped every custom rule to its exact MITRE ATT&CK ID (e.g., `<mitre>T1059.001</mitre>`) so the AI backend could process it.

---

## 6. Phase 5: SentinelView GUI Development
**Owners:** Adham & Anas

1. **Tech Stack & Architecture:**
   - Scaffolded a modern Single-Page Application (SPA) using React, TypeScript, and Vite.
   - Styled the application using Tailwind CSS, focusing on a dark-mode "SOC" aesthetic with glassmorphism and real-time pulsing animations.
2. **Backend Proxy Routing (Node.js):**
   - Since Wazuh APIs suffer from strict CORS policies and self-signed certificate issues, Anas & Adham built a Node.js reverse proxy within `vite.config.ts`.
   - **Security:** Removed all plaintext passwords from the browser bundle. The Node.js proxy intercepts outgoing API calls and secretly injects the `Authorization: Basic` Base64 headers on the server side before forwarding the request to AWS.
3. **Dashboard Components:**
   - **Live Agents Map:** Fetches `/agents` to dynamically render the Windows and Linux endpoints with their connection status.
   - **Live Alerts Feed:** Polls the Wazuh Elasticsearch Indexer for high-severity threat data.
   - **MITRE Coverage Matrix:** A visual grid displaying the frequency of specific MITRE Tactic triggers.

---

## 7. Phase 6: Artificial Intelligence Integration
**Owner:** Anas

To separate this platform from standard SIEMs, Anas built a specialized generative AI layer into SentinelView.

1. **AI Heuristic Engine:**
   - Developed `aiService.ts`, mapping every MITRE ATT&CK technique to a specific risk coefficient based on real-world impact (e.g., Credential Dumping carries higher weight than Discovery).
2. **True Positive Verification Engine:**
   - Wrote an algorithm that evaluates Wazuh alerts in real-time. If an alert's base severity, combined with its MITRE Risk Score and heuristic weights, exceeds the threshold, the system automatically promotes the alert into the **"AI-Verified Threats (True Positives)"** block on the dashboard.
   - Alerts that fall below the threshold are neatly sequestered into a paginated **"False Positives / Noise"** block.
3. **Generative Threat Summarization:**
   - Integrated advanced logic allowing the dashboard to instantly generate plain-English incident summaries, remediation steps, and technical breakdowns for any clicked alert.

---

## 8. Conclusion & Demo
Through seamless collaboration, the team successfully engineered a complete pipeline. The raw logs generated by Masoud and Youssef flow instantly from their local VMs into Hazem & Abdelrahman's AWS cloud. Anas's custom rules detect the attacks, and the data is piped securely into the custom SentinelView dashboard built by Anas and Adham, where the AI validates the threats with pinpoint accuracy.
