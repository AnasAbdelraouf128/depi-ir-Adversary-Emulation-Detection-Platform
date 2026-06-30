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
- **Features:** 
  - Real-time Agent Monitoring (Active/Disconnected states, OS mapping).
  - Live Alert Feed with Severity mapping.
  - Interactive MITRE ATT&CK coverage matrix.
  - AI Assistant for log summarization.

*(Please add your SentinelView GUI screenshots here:)*
- `![Dashboard Overview](docs/assets/gui_dashboard.png)`
- `![AI Assistant](docs/assets/gui_ai.png)`

---

## 🔗 Phase 3: Agent Deployment & Configuration

### 🐧 1. Linux Endpoint (Ubuntu)
- Installed the Wazuh Agent via APT.
- Configured `/var/ossec/etc/ossec.conf` to point to the AWS Elastic IP.

![Ubuntu Agent Configuration](docs/assets/Youssef_step_4.png)

### 🪟 2. Windows Endpoint (Windows 11)
- Installed the Wazuh Agent via MSI silently.
- Deployed Sysmon with SwiftOnSecurity's configuration for deep telemetry.

![Windows Agent Configuration](docs/assets/Masoud_step_2.png)
![Windows Sysmon Setup](docs/assets/Masoud_step_7.png)

---

## ⚔️ Phase 4: Threat Simulation (MITRE ATT&CK)

### Attack 1 & 2: PowerShell & LSASS (Windows)
- Simulated `T1059.001` & `T1003.001` using **Atomic Red Team**.

![Windows Attack Execution](docs/assets/Masoud_step_18.png)

### Attack 3 & 4: SSH Brute Force & Persistence (Linux)
- Simulated `T1110.001` using `hydra` and `T1136.001` via `useradd`.

![Linux Attack Execution](docs/assets/Youssef_step_6.png)

---

## 👥 Team Roles & Responsibilities

This project was a collaborative effort, with the architecture securely partitioned into specialized roles:

### 👑 Team Lead & Architect (You)
- **Infrastructure:** Provisioned the AWS EC2 instance, managed the Elastic IP routing, and deployed the Wazuh Central Manager.
![AWS Setup](docs/assets/AWS_step_1.png)
- **Frontend Engineering:** Designed and built the custom **SentinelView** React dashboard from scratch.
- **SIEM Tuning:** Purged 14,000+ noisy Systemd alerts from the Indexer.

### 🐧 Linux Security Engineer (Youssef)
- **Endpoint Setup:** Provisioned and secured the Ubuntu Virtual Machine.
- **Threat Simulation:** Acted as the Red Team by successfully executing Linux-based attacks (SSH Brute Force & Persistence).
![Youssef Workflow](docs/assets/Youssef_step_7.png)

### 🪟 Windows Security Engineer (Masoud)
- **Endpoint Setup:** Provisioned the Windows 11 Virtual Machine.
- **Deep Visibility:** Successfully deployed and configured **Sysmon**.
- **Threat Simulation:** Executed advanced Windows-based attacks (Obfuscated PowerShell & LSASS Dumping).
![Masoud Workflow](docs/assets/Masoud_step_14.png)

---

## 🏁 Conclusion

This project successfully demonstrates a full-circle security operation: from infrastructure deployment and log ingestion to custom data visualization and live threat detection. SentinelView acts as the perfect lightweight lens into the power of the Wazuh engine.
