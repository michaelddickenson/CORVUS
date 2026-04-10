/**
 * MITRE ATT&CK Enterprise — Bundled static data (OQ-002 resolved)
 *
 * Representative subset covering the most commonly referenced techniques.
 * Works fully offline / air-gapped — no live API dependency.
 *
 * To extend with the full dataset:
 *   1. Download enterprise-attack.json from https://github.com/mitre/cti
 *   2. Parse techniques and subtechniques from the STIX bundle
 *   3. Replace or merge with this array
 *
 * Last sync: ATT&CK Enterprise v15 (subset)
 */

export interface MitreTechnique {
  id: string;     // e.g. "T1059" or "T1059.001"
  name: string;   // e.g. "Command and Scripting Interpreter: PowerShell"
  tactic: string; // e.g. "Execution"
}

export const MITRE_TECHNIQUES: MitreTechnique[] = [
  // ── Initial Access ──────────────────────────────────────────────────────
  { id: "T1190",     tactic: "Initial Access",       name: "Exploit Public-Facing Application" },
  { id: "T1566",     tactic: "Initial Access",       name: "Phishing" },
  { id: "T1566.001", tactic: "Initial Access",       name: "Phishing: Spearphishing Attachment" },
  { id: "T1566.002", tactic: "Initial Access",       name: "Phishing: Spearphishing Link" },
  { id: "T1566.003", tactic: "Initial Access",       name: "Phishing: Spearphishing via Service" },
  { id: "T1078",     tactic: "Initial Access",       name: "Valid Accounts" },
  { id: "T1078.001", tactic: "Initial Access",       name: "Valid Accounts: Default Accounts" },
  { id: "T1078.002", tactic: "Initial Access",       name: "Valid Accounts: Domain Accounts" },
  { id: "T1078.003", tactic: "Initial Access",       name: "Valid Accounts: Local Accounts" },
  { id: "T1133",     tactic: "Initial Access",       name: "External Remote Services" },
  { id: "T1200",     tactic: "Initial Access",       name: "Hardware Additions" },
  { id: "T1091",     tactic: "Initial Access",       name: "Replication Through Removable Media" },
  { id: "T1195",     tactic: "Initial Access",       name: "Supply Chain Compromise" },
  { id: "T1189",     tactic: "Initial Access",       name: "Drive-by Compromise" },
  // ── Execution ───────────────────────────────────────────────────────────
  { id: "T1059",     tactic: "Execution",            name: "Command and Scripting Interpreter" },
  { id: "T1059.001", tactic: "Execution",            name: "Command and Scripting Interpreter: PowerShell" },
  { id: "T1059.002", tactic: "Execution",            name: "Command and Scripting Interpreter: AppleScript" },
  { id: "T1059.003", tactic: "Execution",            name: "Command and Scripting Interpreter: Windows Command Shell" },
  { id: "T1059.004", tactic: "Execution",            name: "Command and Scripting Interpreter: Unix Shell" },
  { id: "T1059.005", tactic: "Execution",            name: "Command and Scripting Interpreter: Visual Basic" },
  { id: "T1059.006", tactic: "Execution",            name: "Command and Scripting Interpreter: Python" },
  { id: "T1059.007", tactic: "Execution",            name: "Command and Scripting Interpreter: JavaScript" },
  { id: "T1203",     tactic: "Execution",            name: "Exploitation for Client Execution" },
  { id: "T1204",     tactic: "Execution",            name: "User Execution" },
  { id: "T1204.001", tactic: "Execution",            name: "User Execution: Malicious Link" },
  { id: "T1204.002", tactic: "Execution",            name: "User Execution: Malicious File" },
  { id: "T1106",     tactic: "Execution",            name: "Native API" },
  { id: "T1047",     tactic: "Execution",            name: "Windows Management Instrumentation" },
  { id: "T1053",     tactic: "Execution",            name: "Scheduled Task/Job" },
  { id: "T1053.005", tactic: "Execution",            name: "Scheduled Task/Job: Scheduled Task" },
  { id: "T1129",     tactic: "Execution",            name: "Shared Modules" },
  // ── Persistence ─────────────────────────────────────────────────────────
  { id: "T1547",     tactic: "Persistence",          name: "Boot or Logon Autostart Execution" },
  { id: "T1547.001", tactic: "Persistence",          name: "Boot or Logon Autostart Execution: Registry Run Keys / Startup Folder" },
  { id: "T1543",     tactic: "Persistence",          name: "Create or Modify System Process" },
  { id: "T1543.003", tactic: "Persistence",          name: "Create or Modify System Process: Windows Service" },
  { id: "T1136",     tactic: "Persistence",          name: "Create Account" },
  { id: "T1136.001", tactic: "Persistence",          name: "Create Account: Local Account" },
  { id: "T1136.002", tactic: "Persistence",          name: "Create Account: Domain Account" },
  { id: "T1098",     tactic: "Persistence",          name: "Account Manipulation" },
  { id: "T1505",     tactic: "Persistence",          name: "Server Software Component" },
  { id: "T1505.003", tactic: "Persistence",          name: "Server Software Component: Web Shell" },
  { id: "T1078",     tactic: "Persistence",          name: "Valid Accounts" },
  // ── Privilege Escalation ─────────────────────────────────────────────────
  { id: "T1068",     tactic: "Privilege Escalation", name: "Exploitation for Privilege Escalation" },
  { id: "T1055",     tactic: "Privilege Escalation", name: "Process Injection" },
  { id: "T1055.001", tactic: "Privilege Escalation", name: "Process Injection: Dynamic-link Library Injection" },
  { id: "T1055.002", tactic: "Privilege Escalation", name: "Process Injection: Portable Executable Injection" },
  { id: "T1055.012", tactic: "Privilege Escalation", name: "Process Injection: Process Hollowing" },
  { id: "T1134",     tactic: "Privilege Escalation", name: "Access Token Manipulation" },
  { id: "T1134.001", tactic: "Privilege Escalation", name: "Access Token Manipulation: Token Impersonation/Theft" },
  { id: "T1548",     tactic: "Privilege Escalation", name: "Abuse Elevation Control Mechanism" },
  { id: "T1548.002", tactic: "Privilege Escalation", name: "Abuse Elevation Control Mechanism: Bypass User Account Control" },
  // ── Defense Evasion ──────────────────────────────────────────────────────
  { id: "T1027",     tactic: "Defense Evasion",      name: "Obfuscated Files or Information" },
  { id: "T1027.001", tactic: "Defense Evasion",      name: "Obfuscated Files or Information: Binary Padding" },
  { id: "T1036",     tactic: "Defense Evasion",      name: "Masquerading" },
  { id: "T1036.005", tactic: "Defense Evasion",      name: "Masquerading: Match Legitimate Name or Location" },
  { id: "T1070",     tactic: "Defense Evasion",      name: "Indicator Removal" },
  { id: "T1070.001", tactic: "Defense Evasion",      name: "Indicator Removal: Clear Windows Event Logs" },
  { id: "T1070.004", tactic: "Defense Evasion",      name: "Indicator Removal: File Deletion" },
  { id: "T1562",     tactic: "Defense Evasion",      name: "Impair Defenses" },
  { id: "T1562.001", tactic: "Defense Evasion",      name: "Impair Defenses: Disable or Modify Tools" },
  { id: "T1112",     tactic: "Defense Evasion",      name: "Modify Registry" },
  { id: "T1218",     tactic: "Defense Evasion",      name: "System Binary Proxy Execution" },
  { id: "T1218.011", tactic: "Defense Evasion",      name: "System Binary Proxy Execution: Rundll32" },
  { id: "T1140",     tactic: "Defense Evasion",      name: "Deobfuscate/Decode Files or Information" },
  // ── Credential Access ────────────────────────────────────────────────────
  { id: "T1003",     tactic: "Credential Access",    name: "OS Credential Dumping" },
  { id: "T1003.001", tactic: "Credential Access",    name: "OS Credential Dumping: LSASS Memory" },
  { id: "T1003.002", tactic: "Credential Access",    name: "OS Credential Dumping: Security Account Manager" },
  { id: "T1003.003", tactic: "Credential Access",    name: "OS Credential Dumping: NTDS" },
  { id: "T1110",     tactic: "Credential Access",    name: "Brute Force" },
  { id: "T1110.001", tactic: "Credential Access",    name: "Brute Force: Password Guessing" },
  { id: "T1110.003", tactic: "Credential Access",    name: "Brute Force: Password Spraying" },
  { id: "T1555",     tactic: "Credential Access",    name: "Credentials from Password Stores" },
  { id: "T1555.003", tactic: "Credential Access",    name: "Credentials from Password Stores: Credentials from Web Browsers" },
  { id: "T1558",     tactic: "Credential Access",    name: "Steal or Forge Kerberos Tickets" },
  { id: "T1558.003", tactic: "Credential Access",    name: "Steal or Forge Kerberos Tickets: Kerberoasting" },
  { id: "T1539",     tactic: "Credential Access",    name: "Steal Web Session Cookie" },
  // ── Discovery ────────────────────────────────────────────────────────────
  { id: "T1082",     tactic: "Discovery",            name: "System Information Discovery" },
  { id: "T1083",     tactic: "Discovery",            name: "File and Directory Discovery" },
  { id: "T1057",     tactic: "Discovery",            name: "Process Discovery" },
  { id: "T1018",     tactic: "Discovery",            name: "Remote System Discovery" },
  { id: "T1049",     tactic: "Discovery",            name: "System Network Connections Discovery" },
  { id: "T1069",     tactic: "Discovery",            name: "Permission Groups Discovery" },
  { id: "T1069.001", tactic: "Discovery",            name: "Permission Groups Discovery: Local Groups" },
  { id: "T1069.002", tactic: "Discovery",            name: "Permission Groups Discovery: Domain Groups" },
  { id: "T1046",     tactic: "Discovery",            name: "Network Service Discovery" },
  { id: "T1087",     tactic: "Discovery",            name: "Account Discovery" },
  { id: "T1087.002", tactic: "Discovery",            name: "Account Discovery: Domain Account" },
  { id: "T1016",     tactic: "Discovery",            name: "System Network Configuration Discovery" },
  // ── Lateral Movement ─────────────────────────────────────────────────────
  { id: "T1021",     tactic: "Lateral Movement",     name: "Remote Services" },
  { id: "T1021.001", tactic: "Lateral Movement",     name: "Remote Services: Remote Desktop Protocol" },
  { id: "T1021.002", tactic: "Lateral Movement",     name: "Remote Services: SMB/Windows Admin Shares" },
  { id: "T1021.004", tactic: "Lateral Movement",     name: "Remote Services: SSH" },
  { id: "T1021.006", tactic: "Lateral Movement",     name: "Remote Services: Windows Remote Management" },
  { id: "T1550",     tactic: "Lateral Movement",     name: "Use Alternate Authentication Material" },
  { id: "T1550.002", tactic: "Lateral Movement",     name: "Use Alternate Authentication Material: Pass the Hash" },
  { id: "T1534",     tactic: "Lateral Movement",     name: "Internal Spearphishing" },
  { id: "T1570",     tactic: "Lateral Movement",     name: "Lateral Tool Transfer" },
  // ── Collection ───────────────────────────────────────────────────────────
  { id: "T1005",     tactic: "Collection",           name: "Data from Local System" },
  { id: "T1039",     tactic: "Collection",           name: "Data from Network Shared Drive" },
  { id: "T1074",     tactic: "Collection",           name: "Data Staged" },
  { id: "T1074.001", tactic: "Collection",           name: "Data Staged: Local Data Staging" },
  { id: "T1113",     tactic: "Collection",           name: "Screen Capture" },
  { id: "T1560",     tactic: "Collection",           name: "Archive Collected Data" },
  { id: "T1560.001", tactic: "Collection",           name: "Archive Collected Data: Archive via Utility" },
  { id: "T1056",     tactic: "Collection",           name: "Input Capture" },
  { id: "T1056.001", tactic: "Collection",           name: "Input Capture: Keylogging" },
  { id: "T1119",     tactic: "Collection",           name: "Automated Collection" },
  { id: "T1115",     tactic: "Collection",           name: "Clipboard Data" },
  // ── Command and Control ──────────────────────────────────────────────────
  { id: "T1071",     tactic: "Command and Control",  name: "Application Layer Protocol" },
  { id: "T1071.001", tactic: "Command and Control",  name: "Application Layer Protocol: Web Protocols" },
  { id: "T1071.004", tactic: "Command and Control",  name: "Application Layer Protocol: DNS" },
  { id: "T1090",     tactic: "Command and Control",  name: "Proxy" },
  { id: "T1090.001", tactic: "Command and Control",  name: "Proxy: Internal Proxy" },
  { id: "T1090.003", tactic: "Command and Control",  name: "Proxy: Multi-hop Proxy" },
  { id: "T1102",     tactic: "Command and Control",  name: "Web Service" },
  { id: "T1105",     tactic: "Command and Control",  name: "Ingress Tool Transfer" },
  { id: "T1219",     tactic: "Command and Control",  name: "Remote Access Software" },
  { id: "T1132",     tactic: "Command and Control",  name: "Data Encoding" },
  { id: "T1573",     tactic: "Command and Control",  name: "Encrypted Channel" },
  { id: "T1573.001", tactic: "Command and Control",  name: "Encrypted Channel: Symmetric Cryptography" },
  // ── Exfiltration ─────────────────────────────────────────────────────────
  { id: "T1041",     tactic: "Exfiltration",         name: "Exfiltration Over C2 Channel" },
  { id: "T1048",     tactic: "Exfiltration",         name: "Exfiltration Over Alternative Protocol" },
  { id: "T1048.003", tactic: "Exfiltration",         name: "Exfiltration Over Alternative Protocol: Exfiltration Over Unencrypted Non-C2 Protocol" },
  { id: "T1567",     tactic: "Exfiltration",         name: "Exfiltration Over Web Service" },
  { id: "T1567.002", tactic: "Exfiltration",         name: "Exfiltration Over Web Service: Exfiltration to Cloud Storage" },
  { id: "T1052",     tactic: "Exfiltration",         name: "Exfiltration Over Physical Medium" },
  // ── Impact ───────────────────────────────────────────────────────────────
  { id: "T1485",     tactic: "Impact",               name: "Data Destruction" },
  { id: "T1486",     tactic: "Impact",               name: "Data Encrypted for Impact" },
  { id: "T1490",     tactic: "Impact",               name: "Inhibit System Recovery" },
  { id: "T1491",     tactic: "Impact",               name: "Defacement" },
  { id: "T1491.001", tactic: "Impact",               name: "Defacement: Internal Defacement" },
  { id: "T1491.002", tactic: "Impact",               name: "Defacement: External Defacement" },
  { id: "T1498",     tactic: "Impact",               name: "Network Denial of Service" },
  { id: "T1498.001", tactic: "Impact",               name: "Network Denial of Service: Direct Network Flood" },
  { id: "T1499",     tactic: "Impact",               name: "Endpoint Denial of Service" },
  { id: "T1496",     tactic: "Impact",               name: "Resource Hijacking" },
  { id: "T1489",     tactic: "Impact",               name: "Service Stop" },
];

/**
 * Search MITRE techniques by technique ID or name (case-insensitive substring).
 * Used by the /api/mitre typeahead endpoint.
 */
export function searchMitreTechniques(q: string, limit = 10): MitreTechnique[] {
  const lower = q.toLowerCase().trim();
  if (!lower) return [];
  return MITRE_TECHNIQUES.filter(
    (t) =>
      t.id.toLowerCase().includes(lower) ||
      t.name.toLowerCase().includes(lower) ||
      t.tactic.toLowerCase().includes(lower)
  ).slice(0, limit);
}
