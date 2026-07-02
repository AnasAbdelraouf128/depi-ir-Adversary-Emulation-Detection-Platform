# SentinelView: Full End-to-End SOC Deployment & Adversary Emulation Report

**Project Name:** SentinelView
**Objective:** Deploy a complete Security Information and Event Management (SIEM) pipeline on AWS, execute MITRE ATT&CK adversarial emulations across Linux and Windows endpoints, and visualize the threats in real-time through a custom AI-integrated React dashboard.

---

## 1. Cloud Engineering & Infrastructure (Hazem & Abdelrahman)

The foundation of the project relies on a robust and secure Cloud Infrastructure hosted on AWS. Hazem and Abdelrahman engineered the deployment of the Wazuh Central Manager and its routing components.

### 1.1 AWS EC2 Provisioning
1. **Launch Instance:** Navigated to the AWS EC2 Console to provision the central server.
   ![AWS Step 1](docs/assets/AWS_step_1.png)
2. **Instance Configuration:**
   - **Name:** `Wazuh-Manager`
   - **OS:** Ubuntu Server 24.04 LTS
   - **Instance Type:** `m7i-flex.large` (to handle high-volume Elasticsearch indexing)
   - **Key Pair:** Generated `Wazuh-Key.pem` (RSA) for secure SSH access.
   - **Storage:** Allocated a `40 GB GP3` EBS volume.
   ![AWS Step 2](docs/assets/AWS_step_2.png)
   ![AWS Step 3](docs/assets/AWS_step_3.png)
3. **Security Group Configuration:** 
   Created `Wazuh-SG` and opened the following critical ports:
   - `22 (TCP)`: SSH Access
   - `443 (TCP)`: Wazuh Dashboard (Kibana)
   - `1514 (TCP)`: Agent Log Communication
   - `1515 (TCP)`: Agent Enrollment
   - `55000 (TCP)`: Wazuh REST API
   ![AWS Step 4](docs/assets/AWS_step_4.png)

### 1.2 Elastic IP & Networking
To ensure endpoints never lose connection if the server restarts, a static routing address was required.
- **Allocation:** Allocated a new Elastic IP (`54.83.241.104`).
- **Association:** Bound the Elastic IP directly to the `Wazuh-Manager` EC2 instance.
   ![AWS Step 5](docs/assets/AWS_step_5.png)

### 1.3 Wazuh Server Installation
1. **SSH Connection:** `ssh -i Wazuh-Key.pem ubuntu@54.83.241.104`
2. **System Update:** 
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
   ![AWS Step 6](docs/assets/AWS_step_6.png)
3. **Wazuh Automated Installation:**
   ```bash
   curl -sO https://packages.wazuh.com/4.11/wazuh-install.sh
   sudo bash ./wazuh-install.sh -a
   ```
   ![AWS Step 7](docs/assets/AWS_step_7.png)
4. **Validation:** Extracted the admin credentials and successfully logged into the Wazuh Dashboard at `https://54.83.241.104/`.
   ![AWS Step 8](docs/assets/AWS_step_8.png)
5. **Disaster Recovery:** Navigated to AWS `Instances -> Actions -> Image and Templates -> Create Image` to take a full backup snapshot of the working state.
   ![AWS Step 9](docs/assets/AWS_step_9.png)

---

## 2. Linux Victim & Adversary Emulation (Youssef Wardany)

Youssef acted as the "Linux Victim", setting up a secure Ubuntu environment, connecting it to Wazuh, and performing real-world cyberattacks using the MITRE ATT&CK framework to generate actionable logs.

### 2.1 Environment Setup & Monitoring
1. **Wazuh Agent Installation:** Installed the agent via APT packages.
   ![Youssef Step 1](docs/assets/Youssef_step_1.png)
   ![Youssef Step 2](docs/assets/Youssef_step_2.png)
2. **Server Binding:** Edited `/var/ossec/etc/ossec.conf` and injected the AWS Elastic IP (`54.83.241.104`) into the `<server><address>` block.
   ![Youssef Step 3](docs/assets/Youssef_step_3.png)
   ![Youssef Step 4](docs/assets/Youssef_step_4.png)
3. **Service Activation:**
   ```bash
   sudo systemctl enable wazuh-agent
   sudo systemctl restart wazuh-agent
   ```
   ![Youssef Step 5](docs/assets/Youssef_step_5.png)

### 2.2 Attack Preparation (Root Level)
To execute advanced emulations, cross-platform tools were required.
```bash
sudo snap install powershell --classic
sudo pwsh
# Installed Invoke-AtomicRedTeam using IEX and the RedCanary repository
```
   ![Youssef Step 6](docs/assets/Youssef_step_6.png)

### 2.3 Attack Simulations
Youssef performed two major attack tests to simulate real hacker behavior:

1. **Credential Access (SSH Brute Force - MITRE T1110.001):**
   - **Action:** Executed `Invoke-AtomicTest T1110.001`.
   - **Result:** The tool successfully simulated password guessing against the local SSH daemon (finding `password123`), generating authentication failure logs that were forwarded to AWS.
   ![Youssef Step 7](docs/assets/Youssef_step_7.png)
   ![Youssef Step 8](docs/assets/Youssef_step_8.png)

2. **Persistence (Create Local Account - MITRE T1136.001):**
   - **Action:** Executed `Invoke-AtomicTest T1136.001`.
   - **Result:** Successfully provisioned a new unauthorized user with `root` privileges. This critical security event was captured and routed to the SIEM.
   ![Youssef Step 9](docs/assets/Youssef_step_9.png)
   ![Youssef Step 10](docs/assets/Youssef_step_10.png)

---

## 3. Windows Victim & Deep Telemetry (Masoud / Alsafy)

Masoud operated the Windows 11 Endpoint. To satisfy the laboratory requirements, he ran concurrent telemetry tools to capture adversarial actions and routed them directly to the centralized Wazuh Manager.

### 3.1 Endpoint Telemetry Deployment
1. **Wazuh Agent Integration:**
   - Downloaded the Windows MSI installer.
   - Executed a silent install bounding it to the Cloud infrastructure:
     ```powershell
     msiexec.exe /i "$env:tmp\wazuh-agent.msi" /q WAZUH_MANAGER="54.83.241.104" WAZUH_REGISTRATION_SERVER="54.83.241.104"
     NET START WazuhSvc
     ```
   ![Masoud Step 1](docs/assets/Masoud_step_1.png)
   ![Masoud Step 2](docs/assets/Masoud_step_2.png)
   ![Masoud Step 3](docs/assets/Masoud_step_3.png)
2. **Microsoft Sysmon (System Monitor):**
   - Downloaded and extracted Sysmon from Sysinternals.
   - Installed it globally to capture granular Event ID 1 (Process Creation) and Event ID 10 (Process Access):
     ```powershell
     & "$env:tmp\Sysmon\Sysmon64.exe" -accepteula -i
     ```
   ![Masoud Step 4](docs/assets/Masoud_step_4.png)
   ![Masoud Step 5](docs/assets/Masoud_step_5.png)
   ![Masoud Step 6](docs/assets/Masoud_step_6.png)
   ![Masoud Step 7](docs/assets/Masoud_step_7.png)

### 3.2 Adversary Emulation Setup (Atomic Red Team)
- Bypassed PowerShell Execution Policies (`Set-ExecutionPolicy Bypass`).
- Installed `Invoke-AtomicRedTeam` and downloaded prerequisites for `T1059.001` and `T1003.001`.
   ![Masoud Step 8](docs/assets/Masoud_step_8.png)
   ![Masoud Step 9](docs/assets/Masoud_step_9.png)
   ![Masoud Step 10](docs/assets/Masoud_step_10.png)
   ![Masoud Step 11](docs/assets/Masoud_step_11.png)
   ![Masoud Step 12](docs/assets/Masoud_step_12.png)
   ![Masoud Step 13](docs/assets/Masoud_step_13.png)

### 3.3 Attack Execution
After disabling Windows Defender Real-Time Protection, Masoud executed the following attacks:

1. **Malicious PowerShell Execution (MITRE T1059.001):**
   - **Action:** Executed heavily obfuscated and Base64-encoded PowerShell payloads.
   - **Telemetry:** Microsoft Sysmon intercepted the execution layer and populated a Process Creation (Event ID 1) log containing the exact encoded strings.
   ![Masoud Step 14](docs/assets/Masoud_step_14.png)
   ![Masoud Step 15](docs/assets/Masoud_step_15.png)
   ![Masoud Step 16](docs/assets/Masoud_step_16.png)
   ![Masoud Step 17](docs/assets/Masoud_step_17.png)

2. **OS Credential Dumping via LSASS (MITRE T1003.001):**
   - **Action:** Attempted to extract plaintext credentials from local memory by targeting the Local Security Authority Subsystem Service (`lsass.exe`) using Procdump/Mimikatz.
   - **Telemetry:** Sysmon flagged the unauthorized memory read, generating a Process Access (Event ID 10) log pointing to `lsass.exe`.
   ![Masoud Step 18](docs/assets/Masoud_step_18.png)
   ![Masoud Step 19](docs/assets/Masoud_step_19.png)

---

## 4. Detection Engineering, GUI & AI Integration (Anas & Adham)

With the Cloud Infrastructure online and the Endpoints actively streaming emulation telemetry, **Anas** (Rules Engineer & AI Developer) and **Adham** (GUI Developer) engineered the custom **SentinelView** visualization and detection platform to replace standard SIEM interfaces.

### 4.1 Securing the Platform & Infrastructure (Anas)
- Bootstrapped the frontend application using React, TypeScript, and Vite.
- **Security Engineering:** Stripped all plaintext Wazuh API and Indexer passwords from the browser bundle. Anas engineered a secure Node.js reverse proxy inside `vite.config.ts` to inject `Authorization: Basic` Base64 headers strictly on the server side. This successfully bypassed strict CORS policies and self-signed certificate issues without exposing credentials to the client.

### 4.2 Building the Dashboard GUI (Adham & Anas)
Anas collaborated heavily with Adham to design and build the core React components of the SentinelView dashboard, focusing on a sleek, dark-mode SOC aesthetic using Tailwind CSS and glassmorphism.

- **Data Integration:** Built the logic to connect securely to the Wazuh Manager API and fetch live Agent telemetry (Status, OS, IP).
- **Alerts Feed:** Connected the dashboard directly to the Wazuh Elasticsearch Indexer to stream real-time threat data into the application.
- **MITRE Matrix:** Designed and implemented an interactive MITRE ATT&CK coverage matrix that dynamically maps active techniques across the environment.

**SentinelView GUI Showcases:**
![Dashboard Overview](docs/assets/gui_1.png)
![Threat Feed](docs/assets/gui_2.png)
![MITRE Matrix](docs/assets/gui_3.png)
![Agent Telemetry](docs/assets/gui_4.png)
![Agent Details](docs/assets/gui_5.png)
![Live Monitor](docs/assets/gui_6.png)
![Threat Context](docs/assets/gui_7.png)

### 4.3 Rules Engineering & Threat Mapping (Anas)
As the Rules Engineer, Anas was responsible for translating raw telemetry into actionable, high-fidelity security alerts by writing custom Wazuh decoders and XML rules.

**Step 1: Accessing the Ruleset**
- SSH'd directly into the AWS Wazuh Manager (`54.83.241.104`).
- Navigated to the custom rules directory: `nano /var/ossec/etc/rules/local_rules.xml`.

**Step 2: Engineering Windows Detection Rules (Sysmon)**
To detect Masoud's attacks, Anas analyzed Sysmon Event ID 1 (Process Creation) and Event ID 10 (Process Access) and wrote the following strict rules:

```xml
<group name="windows, sysmon, custom_rules,">
  <!-- Detect Malicious Obfuscated PowerShell -->
  <rule id="100001" level="12">
    <if_group>sysmon_event1</if_group>
    <field name="sysmon.image">powershell.exe</field>
    <field name="sysmon.commandLine">-EncodedCommand|-e |Invoke-Expression|IEX</field>
    <description>Suspicious PowerShell Execution Detected</description>
    <mitre>
      <id>T1059.001</id>
    </mitre>
  </rule>

  <!-- Detect LSASS Memory Dumping -->
  <rule id="100002" level="14">
    <if_group>sysmon_event10</if_group>
    <field name="sysmon.targetImage">lsass.exe</field>
    <field name="sysmon.grantedAccess">0x1010|0x1410|0x1f0fff</field>
    <description>LSASS Memory Dump Attempt Detected</description>
    <mitre>
      <id>T1003.001</id>
    </mitre>
  </rule>
</group>
```

**Step 3: Engineering Linux Detection Rules (Auditd/Syslog)**
To detect Youssef's attacks, Anas correlated failed authentication logs and user creation events:

```xml
<group name="linux, custom_rules,">
  <!-- Detect SSH Brute Force (Multiple Failures) -->
  <rule id="100003" level="10" frequency="5" timeframe="60">
    <if_matched_sid>5716</if_matched_sid> <!-- Base SSH Failure Rule -->
    <description>SSH Brute Force Attack Detected</description>
    <mitre>
      <id>T1110.001</id>
    </mitre>
  </rule>

  <!-- Detect Local Account Creation (Persistence) -->
  <rule id="100004" level="8">
    <if_sid>5902</if_sid> <!-- Base sudo/command execution rule -->
    <match>useradd|adduser</match>
    <description>Unauthorized Local Account Created</description>
    <mitre>
      <id>T1136.001</id>
    </mitre>
  </rule>
</group>
```

**Step 4: Restarting the Manager & Validating MITRE Mappings**
- Restarted the Wazuh Engine to compile the new rules: `sudo systemctl restart wazuh-manager`.
- Validated that the `<mitre><id>` blocks successfully parsed into the JSON alert payload, allowing the SentinelView GUI matrix to instantly interpret the data.

### 4.4 Artificial Intelligence & Heuristics Integration (Anas)
To separate SentinelView from a standard SIEM, Anas exclusively designed and integrated a specialized AI and heuristic layer.
- **Heuristic Engine:** Developed `aiService.ts` to assign exact mathematical risk coefficients to various MITRE ATT&CK techniques (e.g., heavily weighting Credential Dumping over basic Discovery).
- **True Positive Verification:** Engineered an algorithm that evaluates Wazuh alerts in real-time. If an alert's base severity and custom MITRE Risk Score exceed a specific threshold, the system automatically verifies it and promotes it to the **"AI-Verified Threats (True Positives)"** feed.
- **Noise Filtering:** Alerts falling below the heuristic threshold are filtered and paginated into a separate "Noise" block, keeping the main feed clean.
- **Generative Threat Summarization:** Integrated generative AI models to provide instant, plain-English incident summaries, technical breakdowns, and remediation steps whenever a verified threat is clicked on the dashboard.

![AI Summarization Engine](docs/assets/gui_8.png)

---

## 5. Final Conclusion
Through seamless collaboration, the **ThreatScopeLab** team engineered a complete, enterprise-grade pipeline. The raw logs generated by **Masoud** and **Youssef** flowed instantly from their local VMs into **Hazem & Abdelrahman's** AWS cloud. **Anas's** custom rules detected the attacks seamlessly, and the telemetry was piped securely into the custom SentinelView dashboard built by **Anas and Adham**, where the AI validated the threats with pinpoint accuracy.
