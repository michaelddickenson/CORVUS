/**
 * prisma/seed.ts — Idempotent admin bootstrap + optional demo data.
 *
 * Usage:
 *   npx prisma db seed
 *
 * Required env vars:
 *   SEED_ADMIN_EMAIL
 *   SEED_ADMIN_NAME
 *   SEED_ADMIN_PASSWORD  (only needed when ENABLE_CREDENTIAL_AUTH=true)
 *
 * Demo data (NEXT_PUBLIC_DEMO_MODE=true):
 *   Creates 10 demo users + 30 sample cases with IOCs, TTPs, assets, entries.
 *   Idempotent — skips creation if sentinel case already exists.
 */

import "dotenv/config";
import {
  PrismaClient,
  Role,
  Team,
  Status,
  TLP,
  ImpactLevel,
  IncidentCat,
  Category,
  EntryType,
  IocType,
  AssetImpact,
  TeamStatus,
  AttackVector,
  MissionImpact,
  Prisma,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Inline generateCaseId — cannot use @/ alias in seed context
// ---------------------------------------------------------------------------
async function generateCaseId(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `DCO-${year}-`;
  const latest = await tx.case.findFirst({
    where: { caseId: { startsWith: prefix } },
    orderBy: { caseId: "desc" },
    select: { caseId: true },
  });
  let next = 1;
  if (latest) {
    const parts = latest.caseId.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) next = lastSeq + 1;
  }
  return `${prefix}${String(next).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

// ---------------------------------------------------------------------------
// Admin bootstrap
// ---------------------------------------------------------------------------
async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const name = process.env.SEED_ADMIN_NAME;
  const rawPassword = process.env.SEED_ADMIN_PASSWORD;
  const isCredentialMode = process.env.ENABLE_CREDENTIAL_AUTH === "true";

  if (!email || !name) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_NAME must be set.");
  }
  if (isCredentialMode && !rawPassword) {
    throw new Error("ENABLE_CREDENTIAL_AUTH is true but SEED_ADMIN_PASSWORD is not set.");
  }

  let password: string | null = null;
  if (isCredentialMode && rawPassword) {
    password = await bcrypt.hash(rawPassword, 12);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] Admin already exists: ${email}`);
    if (existing.role !== Role.ADMIN || existing.name !== name) {
      await prisma.user.update({ where: { email }, data: { name, role: Role.ADMIN } });
      console.log(`[seed] Updated admin name/role.`);
    }
    return;
  }

  const user = await prisma.user.create({
    data: { email, name, role: Role.ADMIN, password, isActive: true },
  });
  console.log(`[seed] Admin created: ${user.email} (id: ${user.id})`);
  if (!password) console.log("[seed] LDAP mode — no password stored.");
}

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------
interface DemoUser {
  email: string;
  name: string;
  role: Role;
  team: Team;
}

const DEMO_USERS: DemoUser[] = [
  { email: "soc1@demo.local",  name: "Alex Rivera",    role: Role.SOC_ANALYST,      team: Team.SOC           },
  { email: "ir1@demo.local",   name: "Jordan Kess",    role: Role.IR_ANALYST,       team: Team.IR            },
  { email: "mal1@demo.local",  name: "Sam Okafor",     role: Role.MALWARE_ANALYST,  team: Team.MALWARE       },
  { email: "cti1@demo.local",  name: "Morgan Lee",     role: Role.CTI_ANALYST,      team: Team.CTI           },
  { email: "cm1@demo.local",   name: "Casey Holt",     role: Role.COUNTERMEASURES,  team: Team.COUNTERMEASURES },
  { email: "lead1@demo.local", name: "Drew Paxton",    role: Role.TEAM_LEAD,        team: Team.SOC           },
  { email: "soc2@demo.local",  name: "Jamie Ortiz",    role: Role.SOC_ANALYST,      team: Team.SOC           },
  { email: "ir2@demo.local",   name: "Taylor Brooks",  role: Role.IR_ANALYST,       team: Team.IR            },
  { email: "mal2@demo.local",  name: "Quinn Nakamura", role: Role.MALWARE_ANALYST,  team: Team.MALWARE       },
  { email: "lead2@demo.local", name: "Reese Calloway", role: Role.TEAM_LEAD,        team: Team.IR            },
];

const DEMO_PASSWORD = "demo1234";

// Public-facing demo accounts — always use password Demo1234!
const PUBLIC_DEMO_USERS: DemoUser[] = [
  { email: "demouser1@demo.local", name: "Demo User 1", role: Role.SOC_ANALYST, team: Team.SOC },
  { email: "demouser2@demo.local", name: "Demo User 2", role: Role.IR_ANALYST,  team: Team.IR  },
  { email: "demouser3@demo.local", name: "Demo User 3", role: Role.CTI_ANALYST, team: Team.CTI },
  { email: "demoadmin@demo.local", name: "Demo Admin",  role: Role.ADMIN,       team: Team.SOC },
];
const PUBLIC_DEMO_PASSWORD = "Demo1234!";
// Sentinel title — if this case exists, demo data was already seeded
const SENTINEL_TITLE = "Unauthorized Admin Access via Compromised Service Account";

async function seedDemoUsers(): Promise<Record<string, string>> {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const ids: Record<string, string> = {};
  let auditCount = 0;

  for (const u of DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      ids[u.email] = existing.id;
    } else {
      const created = await prisma.user.create({
        data: { email: u.email, name: u.name, role: u.role, team: u.team, password: hash, isActive: true },
      });
      ids[u.email] = created.id;
      // Write audit log entry for seed-created user (using created user as both actor and target)
      await prisma.auditLog.create({
        data: {
          userId:     created.id,
          action:     "USER_CREATED",
          targetType: "User",
          targetId:   created.id,
          detail:     { name: created.name, email: created.email, role: created.role, source: "seed" } as never,
        },
      });
      auditCount++;
    }
  }
  if (auditCount > 0) {
    console.log(`[seed] Wrote ${auditCount} USER_CREATED audit log entries.`);
  }

  // Public demo accounts — separate password, idempotent
  const pubHash = await bcrypt.hash(PUBLIC_DEMO_PASSWORD, 12);
  let pubCount = 0;
  for (const u of PUBLIC_DEMO_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      ids[u.email] = existing.id;
    } else {
      const created = await prisma.user.create({
        data: { email: u.email, name: u.name, role: u.role, team: u.team, password: pubHash, isActive: true },
      });
      ids[u.email] = created.id;
      await prisma.auditLog.create({
        data: {
          userId:     created.id,
          action:     "USER_CREATED",
          targetType: "User",
          targetId:   created.id,
          detail:     { name: created.name, email: created.email, role: created.role, source: "seed-public" } as never,
        },
      });
      pubCount++;
    }
  }
  if (pubCount > 0) {
    console.log(`[seed] Created ${pubCount} public demo accounts.`);
  }

  return ids;
}

interface CaseSeedDef {
  title: string;
  description: string;
  cat: IncidentCat;
  impactLevel: ImpactLevel;
  category: Category;
  status: Status;
  tlp: TLP;
  classificationCustom?: string;
  assigneeEmail: string;
  creatorEmail: string;
  teamsInvolved: Team[];
  createdDaysAgo: number;
  closedDaysAgo?: number;
  blufSummary?: string;
  recommendedActions?: string;
  teamStatusMap?: Partial<Record<Team, TeamStatus>>;
  // Incident detail fields
  incidentStartedAt?:  string;
  incidentDetectedAt?: string;
  detectionSource?:    string;
  attackVector?:       AttackVector;
  affectedNetwork?:    string;
  missionImpact?:      MissionImpact;
  reportingRequired?:  boolean;
  entries: { type: EntryType; body: string; authorEmail: string; team: Team; offsetHours: number }[];
  iocs: { type: IocType; value: string; description?: string; confidence: number; tlp: TLP }[];
  ttps: { techniqueId: string; techniqueName: string; tactic: string; description?: string }[];
  assets: { hostname?: string; ipAddress?: string; os?: string; assetType?: string; impact: AssetImpact; owner?: string; description?: string }[];
}

function buildCases(u: Record<string, string>): CaseSeedDef[] {
  return [
    // -----------------------------------------------------------------------
    // Case 1 — CAT_1, HIGH, CLOSED, RED
    // -----------------------------------------------------------------------
    {
      title: SENTINEL_TITLE,
      description:
        "A service account with domain admin privileges was used to authenticate from an anomalous external IP. " +
        "Log correlation confirmed credential theft via spear-phishing email. Lateral movement to three servers observed.",
      cat: IncidentCat.CAT_1,
      impactLevel: ImpactLevel.HIGH,
      category: Category.INTRUSION,
      status: Status.CLOSED,
      tlp: TLP.RED,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR, Team.CTI],
      teamStatusMap: { SOC: TeamStatus.COMPLETE, IR: TeamStatus.COMPLETE, CTI: TeamStatus.COMPLETE },
      blufSummary:
        "A domain admin service account (SVC_BACKUP) was compromised via spear-phishing and used to " +
        "authenticate from an APT-affiliated external IP. Mimikatz was deployed on the primary domain " +
        "controller and a file server. CTI attributed indicators to the TEMP.Veles toolset. All affected " +
        "accounts have been reset and the case is closed after 72h of clean monitoring.",
      recommendedActions:
        "1. Enforce LAPS on all servers to prevent password reuse by service accounts.\n" +
        "2. Deploy Credential Guard on all domain controllers.\n" +
        "3. Submit IOC set to ISAC for community sharing.\n" +
        "4. Schedule a post-incident review within 30 days.",
      createdDaysAgo: 85,
      closedDaysAgo: 60,
      entries: [
        { type: EntryType.NOTE, body: "Alert triggered on anomalous logon from 203.0.113.45 using SVC_BACKUP account. Forwarded to IR.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
        { type: EntryType.ESCALATION, body: "Escalated to IR team. Possible credential compromise. Requesting forensic collection on affected servers.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 2 },
        { type: EntryType.NOTE, body: "Memory acquisition complete on DC-PROD-01 and FILE-SRV-03. Identified Mimikatz artifacts and LSASS dump files.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 10 },
        { type: EntryType.ESCALATION, body: "Looping in CTI — the external IP maps to a known APT-affiliated infrastructure cluster.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 12 },
        { type: EntryType.NOTE, body: "CTI confirmed attribution indicators overlap with TEMP.Veles toolset. Recommending IOC sharing with ISAC.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 20 },
        { type: EntryType.NOTE, body: "All affected accounts reset. SVC_BACKUP disabled and replaced. Monitoring confirmed clean for 72h. Closing.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 500 },
      ],
      iocs: [
        { type: IocType.IP, value: "203.0.113.45", description: "External source IP for anomalous admin logon", confidence: 95, tlp: TLP.RED },
        { type: IocType.DOMAIN, value: "update-srv.compat-check.com", description: "C2 domain observed in DNS logs during intrusion window", confidence: 80, tlp: TLP.RED },
        { type: IocType.SHA256, value: "a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2", description: "Mimikatz variant binary recovered from FILE-SRV-03", confidence: 99, tlp: TLP.RED },
        { type: IocType.FILE_PATH, value: "C:\\Windows\\Temp\\svc_update.exe", description: "Dropper path identified on compromised host", confidence: 90, tlp: TLP.RED },
      ],
      ttps: [
        { techniqueId: "T1078", techniqueName: "Valid Accounts", tactic: "Defense Evasion", description: "Adversary used compromised service account credentials" },
        { techniqueId: "T1003.001", techniqueName: "LSASS Memory", tactic: "Credential Access", description: "LSASS dump via Mimikatz observed on domain controller" },
      ],
      assets: [
        { hostname: "DC-PROD-01", ipAddress: "10.0.1.5", os: "Windows Server 2019", assetType: "Domain Controller", impact: AssetImpact.CONFIRMED, owner: "IT Operations", description: "Primary domain controller — LSASS dump confirmed" },
        { hostname: "FILE-SRV-03", ipAddress: "10.0.1.22", os: "Windows Server 2016", assetType: "File Server", impact: AssetImpact.CONFIRMED, owner: "IT Operations", description: "Lateral movement target — malicious binary recovered" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 2 — CAT_2, MEDIUM, CLOSED, AMBER
    // -----------------------------------------------------------------------
    {
      title: "Phishing-Enabled User Account Compromise",
      description:
        "User jdoe@corp.local clicked a credential-harvesting link in a spear-phishing email. " +
        "Account used for unauthorized email forwarding rule and SharePoint access within 20 minutes of compromise.",
      cat: IncidentCat.CAT_2,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.PHISHING,
      status: Status.CLOSED,
      tlp: TLP.AMBER,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR],
      teamStatusMap: { SOC: TeamStatus.COMPLETE, IR: TeamStatus.COMPLETE },
      blufSummary:
        "User jdoe@corp.local fell victim to a spear-phishing link resulting in credential theft. " +
        "An unauthorized inbox forwarding rule was created within 20 minutes of compromise. " +
        "IR contained the incident by disabling the account, revoking sessions, and removing the rule. " +
        "No lateral movement detected. Case closed.",
      createdDaysAgo: 70,
      closedDaysAgo: 65,
      entries: [
        { type: EntryType.NOTE, body: "User reported suspicious email. Anti-phishing gateway missed due to lookalike domain. Credential harvest page confirmed.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Account jdoe compromised — unauthorized inbox rule created forwarding all mail to external address. Escalating IR.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
        { type: EntryType.NOTE, body: "IR contained: account disabled, sessions revoked, forwarding rule removed. No further lateral movement detected.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 4 },
        { type: EntryType.NOTE, body: "Phishing domain submitted for takedown. Email gateway rule added. Closing case.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 48 },
      ],
      iocs: [
        { type: IocType.URL, value: "https://login.corp-portal.account-verify.net/auth", description: "Credential harvest landing page", confidence: 98, tlp: TLP.AMBER },
        { type: IocType.EMAIL, value: "it-helpdesk@account-verify.net", description: "Phishing sender address (lookalike)", confidence: 95, tlp: TLP.AMBER },
        { type: IocType.DOMAIN, value: "account-verify.net", description: "Phishing infrastructure domain", confidence: 95, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1566.002", techniqueName: "Spearphishing Link", tactic: "Initial Access", description: "Targeted phishing email with credential harvest link" },
        { techniqueId: "T1098", techniqueName: "Account Manipulation", tactic: "Persistence", description: "Inbox forwarding rule added post-compromise" },
      ],
      assets: [
        { hostname: "WS-JDOE-01", ipAddress: "10.10.5.112", os: "Windows 10", assetType: "Workstation", impact: AssetImpact.CLEARED, owner: "jdoe@corp.local", description: "Compromised user workstation — cleared after account remediation" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 3 — CAT_3, LOW, NEW, GREEN
    // -----------------------------------------------------------------------
    {
      title: "Repeated SSH Brute Force Attempts — External Source",
      description:
        "Firewall logs show sustained SSH brute force attempts against jump-host SSH-GW-01 from a rotating " +
        "block of IP addresses. ~4,200 attempts over 6 hours. No successful authentication.",
      cat: IncidentCat.CAT_3,
      impactLevel: ImpactLevel.LOW,
      category: Category.INTRUSION,
      status: Status.NEW,
      tlp: TLP.GREEN,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC],
      createdDaysAgo: 1,
      entries: [
        { type: EntryType.NOTE, body: "IDS alert on threshold breach for failed SSH auth. Log review confirms brute force pattern. No successful auth. Blocking source ranges.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "Added 185.220.0.0/16 and 45.142.0.0/16 to perimeter deny list. Monitoring for shift to new source ranges.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 2 },
      ],
      iocs: [
        { type: IocType.IP, value: "185.220.101.47", description: "Primary brute force source IP", confidence: 85, tlp: TLP.GREEN },
        { type: IocType.IP, value: "45.142.212.100", description: "Secondary brute force source IP (rotating pool)", confidence: 75, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1110.001", techniqueName: "Password Guessing", tactic: "Credential Access", description: "Automated SSH brute force against jump host" },
      ],
      assets: [
        { hostname: "SSH-GW-01", ipAddress: "198.51.100.10", os: "Ubuntu 22.04", assetType: "Jump Host", impact: AssetImpact.CLEARED, owner: "IT Operations", description: "Internet-facing SSH gateway — no successful auth confirmed" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 4 — CAT_4, HIGH, IN_PROGRESS, AMBER
    // -----------------------------------------------------------------------
    {
      title: "Distributed Denial of Service Against Public-Facing Web Services",
      description:
        "Volumetric DDoS attack targeting web-prod.corp.local. Peak traffic 38 Gbps. " +
        "Services degraded for 47 minutes before upstream scrubbing engaged. Attack continues in low-bandwidth probing phase.",
      cat: IncidentCat.CAT_4,
      impactLevel: ImpactLevel.HIGH,
      category: Category.OTHER,
      status: Status.IN_PROGRESS,
      tlp: TLP.AMBER,
      classificationCustom: "Special Handling",
      assigneeEmail: "cm1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.COUNTERMEASURES],
      teamStatusMap: { SOC: TeamStatus.PENDING, COUNTERMEASURES: TeamStatus.ACTIVE },
      blufSummary:
        "Volumetric DDoS (peak 38 Gbps) against web-prod.corp.local caused 47 minutes of service degradation. " +
        "Upstream scrubbing is now engaged. Attack continues in low-bandwidth probing phase. " +
        "Countermeasures team is actively managing traffic filtering.",
      createdDaysAgo: 3,
      entries: [
        { type: EntryType.NOTE, body: "NOC alerted on bandwidth saturation. Public web cluster degraded. Declared active DDoS at 14:32 UTC.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to Countermeasures for upstream mitigation coordination.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "Upstream scrubbing center activated at 15:19 UTC. Traffic normalized. Volumetric attack ended but low-rate probes continuing.", authorEmail: "cm1@demo.local", team: Team.COUNTERMEASURES, offsetHours: 1 },
        { type: EntryType.NOTE, body: "Rate-limiting rules pushed to edge. Analyzing attack signature for ACL tuning.", authorEmail: "cm1@demo.local", team: Team.COUNTERMEASURES, offsetHours: 6 },
      ],
      iocs: [
        { type: IocType.IP, value: "198.51.100.200", description: "High-volume attack source — top contributor", confidence: 70, tlp: TLP.AMBER },
        { type: IocType.IP, value: "203.0.113.100", description: "Reflected amplification source (NTP)", confidence: 60, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1498.001", techniqueName: "Direct Network Flood", tactic: "Impact", description: "Volumetric DDoS via UDP flood targeting web cluster" },
        { techniqueId: "T1498.002", techniqueName: "Reflection Amplification", tactic: "Impact", description: "NTP amplification component observed in traffic analysis" },
      ],
      assets: [
        { hostname: "WEB-PROD-01", ipAddress: "198.51.100.50", os: "Linux", assetType: "Web Server", impact: AssetImpact.SUSPECTED, owner: "Platform Engineering", description: "Primary public web server — degraded during attack peak" },
        { hostname: "WEB-PROD-02", ipAddress: "198.51.100.51", os: "Linux", assetType: "Web Server", impact: AssetImpact.SUSPECTED, owner: "Platform Engineering", description: "Secondary web server — same degradation pattern" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 5 — CAT_5, LOW, IN_PROGRESS, GREEN
    // -----------------------------------------------------------------------
    {
      title: "Unauthorized USB Mass Storage Device — Noncompliance",
      description:
        "DLP agent flagged USB mass storage device connected to classified workstation WS-CLASSIFIED-07. " +
        "Device belongs to contractor. No data exfiltration confirmed but investigation ongoing.",
      cat: IncidentCat.CAT_5,
      impactLevel: ImpactLevel.LOW,
      category: Category.NONCOMPLIANCE,
      status: Status.IN_PROGRESS,
      tlp: TLP.GREEN,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC],
      createdDaysAgo: 5,
      entries: [
        { type: EntryType.NOTE, body: "DLP alert at 09:14 UTC. USB device VID/PID 0781:5583 (SanDisk) connected to classified workstation. Contractor notified and device seized.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "Device forensic image acquired. Reviewing file access logs to confirm no sensitive data was copied.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 8 },
        { type: EntryType.NOTE, body: "Log review: 14 files accessed on device, all contractor's personal documents. No classified data on device. Awaiting policy review outcome.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 24 },
      ],
      iocs: [
        { type: IocType.OTHER, value: "VID_0781&PID_5583", description: "USB device identifier (SanDisk Cruzer)", confidence: 100, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1052.001", techniqueName: "Exfiltration Over USB", tactic: "Exfiltration", description: "Suspected USB data staging — not confirmed" },
      ],
      assets: [
        { hostname: "WS-CLASSIFIED-07", ipAddress: "10.50.1.7", os: "Windows 10 LTSC", assetType: "Workstation", impact: AssetImpact.SUSPECTED, owner: "Classified Programs", description: "Classified workstation where unauthorized USB was connected" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 6 — CAT_6, MEDIUM, PENDING_REVIEW, GREEN
    // -----------------------------------------------------------------------
    {
      title: "Systematic External Reconnaissance Scan Against DMZ",
      description:
        "Sustained port scan campaign targeting the full DMZ subnet (10.200.0.0/24). " +
        "Multiple scanning tools fingerprinted. Attribution to automated vulnerability scanner operated by unknown third party.",
      cat: IncidentCat.CAT_6,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.INTRUSION,
      status: Status.PENDING_REVIEW,
      tlp: TLP.GREEN,
      assigneeEmail: "cti1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.CTI],
      createdDaysAgo: 12,
      entries: [
        { type: EntryType.NOTE, body: "SIEM correlation rule fired on port scan pattern. Source 45.33.32.156 (Shodan-linked) scanning TCP 22, 80, 443, 8080, 3389 across full DMZ.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalated to CTI for scan fingerprinting and infrastructure attribution.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 2 },
        { type: EntryType.NOTE, body: "CTI analysis: scan pattern matches Masscan + Nmap service detection combo. Source IP block registered to hosting provider with prior APT attribution history.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 18 },
        { type: EntryType.NOTE, body: "ACLs updated. Threat intel report drafted for ISAC submission. Submitting for lead review before close.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 72 },
      ],
      iocs: [
        { type: IocType.IP, value: "45.33.32.156", description: "Primary scan source IP — Shodan-linked", confidence: 90, tlp: TLP.GREEN },
        { type: IocType.IP, value: "45.33.32.200", description: "Secondary scan source from same /24", confidence: 75, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1595.001", techniqueName: "Scanning IP Blocks", tactic: "Reconnaissance", description: "Systematic port scan of DMZ subnet" },
        { techniqueId: "T1595.002", techniqueName: "Vulnerability Scanning", tactic: "Reconnaissance", description: "Service version detection fingerprinting attempted" },
      ],
      assets: [
        { hostname: "DMZ-PROXY-01", ipAddress: "10.200.0.5", os: "Linux", assetType: "Reverse Proxy", impact: AssetImpact.CLEARED, owner: "Network Ops", description: "DMZ entry point — scan traffic hit but no exploitation" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 7 — CAT_7, HIGH, IN_PROGRESS, RED
    // -----------------------------------------------------------------------
    {
      title: "Cobalt Strike Beacon Detected on Engineering Workstation",
      description:
        "EDR telemetry flagged C2 beacon activity consistent with Cobalt Strike on WS-ENG-14. " +
        "DNS beaconing to known CS malleable C2 profile. Host isolated. Full triage in progress.",
      cat: IncidentCat.CAT_7,
      impactLevel: ImpactLevel.HIGH,
      category: Category.MALWARE,
      status: Status.IN_PROGRESS,
      tlp: TLP.RED,
      assigneeEmail: "mal1@demo.local",
      creatorEmail: "ir1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR, Team.MALWARE],
      createdDaysAgo: 8,
      entries: [
        { type: EntryType.NOTE, body: "EDR alert: beacon to 162.244.83.201 every 60s with jitter. Consistent with CS default profile. Host isolated immediately.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to Malware Analysis for beacon sample triage.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 1 },
        { type: EntryType.NOTE, body: "Memory dump acquired from WS-ENG-14. CS beacon identified in svchost process space (PID 3824). Reflective DLL injection confirmed.", authorEmail: "mal1@demo.local", team: Team.MALWARE, offsetHours: 6 },
        { type: EntryType.NOTE, body: "Beacon config extracted: C2=162.244.83.201:443, sleep=60s, jitter=20%, pipename=MSSE-{random}. Watermark 0x7a4f3b2c — cross-referencing against known actors.", authorEmail: "mal1@demo.local", team: Team.MALWARE, offsetHours: 10 },
        { type: EntryType.NOTE, body: "No evidence of lateral movement from WS-ENG-14 yet. Continuing to review network logs for any additional beaconing hosts.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 24 },
      ],
      iocs: [
        { type: IocType.IP, value: "162.244.83.201", description: "Cobalt Strike C2 server", confidence: 97, tlp: TLP.RED },
        { type: IocType.DOMAIN, value: "cdn-edge-cache.api-metrics.net", description: "CS malleable C2 domain (DNS beaconing)", confidence: 95, tlp: TLP.RED },
        { type: IocType.SHA256, value: "b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5", description: "Beacon DLL extracted from memory (reflective loader)", confidence: 99, tlp: TLP.RED },
        { type: IocType.REGISTRY_KEY, value: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\SvcHostSvc", description: "Persistence registry key set by dropper", confidence: 90, tlp: TLP.RED },
      ],
      ttps: [
        { techniqueId: "T1055.001", techniqueName: "Dynamic-link Library Injection", tactic: "Defense Evasion", description: "Reflective DLL injection into svchost.exe" },
        { techniqueId: "T1071.004", techniqueName: "DNS", tactic: "Command and Control", description: "DNS-based C2 beaconing with malleable profile" },
        { techniqueId: "T1059.001", techniqueName: "PowerShell", tactic: "Execution", description: "PowerShell used for beacon staging and post-exploitation commands" },
      ],
      assets: [
        { hostname: "WS-ENG-14", ipAddress: "10.20.4.114", os: "Windows 11", assetType: "Workstation", impact: AssetImpact.CONFIRMED, owner: "Engineering", description: "Compromised engineering workstation — beacon confirmed, isolated" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 8 — CAT_8, MEDIUM, IN_PROGRESS, AMBER
    // -----------------------------------------------------------------------
    {
      title: "Anomalous WMI Activity — Possible Living-off-the-Land",
      description:
        "SIEM rule triggered on abnormal WMI subscription creation and remote WMI query pattern on MGMT-SRV-02. " +
        "Lateral tool transfer suspected but not confirmed. Investigation in progress.",
      cat: IncidentCat.CAT_8,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.ANOMALOUS_ACTIVITY,
      status: Status.IN_PROGRESS,
      tlp: TLP.AMBER,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR],
      createdDaysAgo: 6,
      entries: [
        { type: EntryType.NOTE, body: "Alert: WMI event subscription created under non-admin account on MGMT-SRV-02. Subscription name 'SvcMonitor' with CommandLineEventConsumer executing powershell.exe.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Pattern consistent with WMI persistence mechanism. Escalating to IR.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
        { type: EntryType.NOTE, body: "WMI subscription removed. Memory acquired. Reviewing PowerShell ScriptBlock logs and network connections from MGMT-SRV-02.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 4 },
        { type: EntryType.NOTE, body: "ScriptBlock logs show encoded commands. Decoded payload appears to be a reconnaissance script (systeminfo, ipconfig, net group). No exfil channel identified yet.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 12 },
      ],
      iocs: [
        { type: IocType.REGISTRY_KEY, value: "ROOT\\subscription:CommandLineEventConsumer.Name=\"SvcMonitor\"", description: "Malicious WMI subscription — persistence mechanism", confidence: 92, tlp: TLP.AMBER },
        { type: IocType.FILE_PATH, value: "C:\\ProgramData\\Microsoft\\Windows\\svcscan.ps1", description: "PowerShell recon script dropped by WMI consumer", confidence: 85, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1546.003", techniqueName: "Windows Management Instrumentation Event Subscription", tactic: "Privilege Escalation", description: "WMI event subscription used for persistence and command execution" },
        { techniqueId: "T1059.001", techniqueName: "PowerShell", tactic: "Execution", description: "Encoded PowerShell execution via WMI consumer" },
      ],
      assets: [
        { hostname: "MGMT-SRV-02", ipAddress: "10.0.2.15", os: "Windows Server 2019", assetType: "Management Server", impact: AssetImpact.SUSPECTED, owner: "IT Operations", description: "Management server targeted by WMI persistence" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 9 — CAT_1, HIGH, PENDING_REVIEW, AMBER (linked to Case 1)
    // -----------------------------------------------------------------------
    {
      title: "Lateral Movement via Pass-the-Hash — Domain Controller Targeted",
      description:
        "Pass-the-hash attack observed originating from WS-DEV-22 targeting the primary domain controller. " +
        "NTLM hashes extracted from prior compromise (see linked case). Privilege escalation to DA attempted.",
      cat: IncidentCat.CAT_1,
      impactLevel: ImpactLevel.HIGH,
      category: Category.INTRUSION,
      status: Status.PENDING_REVIEW,
      tlp: TLP.AMBER,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "ir1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR, Team.CTI],
      createdDaysAgo: 80,
      entries: [
        { type: EntryType.NOTE, body: "Windows Security Event 4624 Logon Type 3 with NTLM auth from WS-DEV-22 to DC-PROD-01 outside normal hours. Pattern consistent with pass-the-hash.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "IR confirmed: NTLM hash of Domain Admin SVC_BACKUP_ADM used. Hash sourced from Case DCO linked — Mimikatz dump. WS-DEV-22 isolated.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 6 },
        { type: EntryType.ESCALATION, body: "Looping in CTI — this may be same actor from linked case. Requesting infrastructure comparison.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 8 },
        { type: EntryType.NOTE, body: "CTI: C2 callback pattern on WS-DEV-22 matches same toolset as prior case. High confidence same actor. Remediation complete — pending lead review.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 48 },
      ],
      iocs: [
        { type: IocType.IP, value: "10.20.3.22", description: "Source host IP for pass-the-hash lateral movement", confidence: 95, tlp: TLP.AMBER },
        { type: IocType.SHA1, value: "aabbccddee112233445566778899aabbccddeeff", description: "NTLM hash of compromised DA account (redacted for sensitivity)", confidence: 99, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1550.002", techniqueName: "Pass the Hash", tactic: "Lateral Movement", description: "PtH using stolen NTLM hash to authenticate to domain controller" },
        { techniqueId: "T1078", techniqueName: "Valid Accounts", tactic: "Defense Evasion", description: "Stolen NTLM hash used to impersonate valid domain admin account" },
        { techniqueId: "T1059.001", techniqueName: "PowerShell", tactic: "Execution", description: "PowerShell-based tooling used to perform lateral movement and enumeration" },
      ],
      assets: [
        { hostname: "WS-DEV-22", ipAddress: "10.20.3.22", os: "Windows 10", assetType: "Workstation", impact: AssetImpact.CONFIRMED, owner: "Development", description: "Pivot host used for pass-the-hash — isolated and reimaged" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 10 — CAT_7, HIGH, CLOSED, AMBER (linked to Case 7)
    // -----------------------------------------------------------------------
    {
      title: "Ransomware Precursor — Scheduled Task and Data Staging Detected",
      description:
        "Ransomware staging behavior detected on FILE-SRV-05: bulk file enumeration, shadow copy deletion attempt, " +
        "and staged archive in C:\\ProgramData\\backup.zip. Attack interrupted before encryption.",
      cat: IncidentCat.CAT_7,
      impactLevel: ImpactLevel.HIGH,
      category: Category.MALWARE,
      status: Status.CLOSED,
      tlp: TLP.AMBER,
      assigneeEmail: "mal1@demo.local",
      creatorEmail: "ir1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR, Team.MALWARE, Team.CTI],
      createdDaysAgo: 7,
      closedDaysAgo: 2,
      entries: [
        { type: EntryType.NOTE, body: "EDR alert: vssadmin.exe delete shadows /all on FILE-SRV-05. Immediate containment initiated.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to Malware Analysis — staged archive detected, possible ransomware precursor.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 0 },
        { type: EntryType.NOTE, body: "Archive analyzed: contained directory listings and sample files. Ransomware payload NOT yet deployed. Attacker interrupted pre-encryption.", authorEmail: "mal1@demo.local", team: Team.MALWARE, offsetHours: 4 },
        { type: EntryType.ESCALATION, body: "Looping in CTI — staging behavior matches Ryuk pre-encryption playbook.", authorEmail: "mal1@demo.local", team: Team.MALWARE, offsetHours: 5 },
        { type: EntryType.NOTE, body: "CTI: TTP overlap with Ryuk affiliate cluster. Linked to Cobalt Strike beacon case (same actor suspected). Reporting to CISA.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 24 },
        { type: EntryType.NOTE, body: "Full remediation complete. All staging artifacts removed. Backups verified. Closing.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 96 },
      ],
      iocs: [
        { type: IocType.FILE_PATH, value: "C:\\ProgramData\\backup.zip", description: "Staged data archive created by attacker pre-encryption", confidence: 99, tlp: TLP.AMBER },
        { type: IocType.SHA256, value: "c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6", description: "Ransomware loader binary (not executed — recovered from staging dir)", confidence: 95, tlp: TLP.AMBER },
        { type: IocType.IP, value: "162.244.83.201", description: "C2 IP shared with Cobalt Strike beacon case", confidence: 97, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1490", techniqueName: "Inhibit System Recovery", tactic: "Impact", description: "VSS deletion attempt to prevent recovery" },
        { techniqueId: "T1560.001", techniqueName: "Archive Collected Data", tactic: "Collection", description: "Data staged in zip archive before exfil/encryption" },
        { techniqueId: "T1486", techniqueName: "Data Encrypted for Impact", tactic: "Impact", description: "Ransomware encryption was the intended final stage — attack interrupted pre-execution" },
        { techniqueId: "T1059.001", techniqueName: "PowerShell", tactic: "Execution", description: "PowerShell used to invoke vssadmin and enumerate staging targets" },
      ],
      assets: [
        { hostname: "FILE-SRV-05", ipAddress: "10.0.1.35", os: "Windows Server 2019", assetType: "File Server", impact: AssetImpact.CONFIRMED, owner: "IT Operations", description: "Ransomware staging target — contained before encryption" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 11 — CAT_2, MEDIUM, IN_PROGRESS, GREEN
    // -----------------------------------------------------------------------
    {
      title: "Insider Threat — Excessive Bulk Data Access by Departing Employee",
      description:
        "DLP and UEBA alerts flagged anomalous bulk SharePoint download activity by employee pending offboarding. " +
        "Over 4,000 files accessed in 90 minutes. HR and Legal notified.",
      cat: IncidentCat.CAT_2,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.INSIDER_THREAT,
      status: Status.IN_PROGRESS,
      tlp: TLP.GREEN,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.CTI],
      createdDaysAgo: 4,
      entries: [
        { type: EntryType.NOTE, body: "UEBA anomaly: user mchen@corp.local downloaded 4,200+ files from Engineering SharePoint site between 08:00–09:33 UTC. User is in offboarding process.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to CTI for data classification review on accessed files.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
        { type: EntryType.NOTE, body: "CTI file sample review: accessed data includes design specifications and internal roadmap documents. Classified as sensitive but not controlled. HR legal hold placed.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 6 },
        { type: EntryType.NOTE, body: "Account suspended at HR request. Downloads confirmed to personal OneDrive — legal action pending HR decision.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 24 },
      ],
      iocs: [
        { type: IocType.EMAIL, value: "mchen@corp.local", description: "Departing employee account used for bulk data access", confidence: 100, tlp: TLP.GREEN },
        { type: IocType.URL, value: "https://corp.sharepoint.com/sites/Engineering/Shared%20Documents", description: "SharePoint library targeted for bulk download", confidence: 100, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1213.002", techniqueName: "Sharepoint", tactic: "Collection", description: "Bulk download of sensitive data from SharePoint site" },
      ],
      assets: [
        { hostname: "N/A", assetType: "Cloud Service", impact: AssetImpact.SUSPECTED, owner: "IT Operations", description: "SharePoint Online — source of bulk data exfiltration" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 12 — CAT_6, LOW, IN_PROGRESS, GREEN (linked to Case 6)
    // -----------------------------------------------------------------------
    {
      title: "Coordinated Port Scan Campaign — Multiple Source IPs",
      description:
        "Second wave of coordinated scanning targeting DMZ from different source IP ranges than prior case. " +
        "Scan pattern shifted to target OT-adjacent services (Modbus 502, BACnet 47808). Under investigation.",
      cat: IncidentCat.CAT_6,
      impactLevel: ImpactLevel.LOW,
      category: Category.INTRUSION,
      status: Status.IN_PROGRESS,
      tlp: TLP.GREEN,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC],
      createdDaysAgo: 2,
      entries: [
        { type: EntryType.NOTE, body: "New scan wave from 89.248.0.0/16. Target ports shifted to include 502 (Modbus) and 47808 (BACnet). Likely coordinated with prior reconnaissance case.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "No OT/ICS systems exposed on DMZ. Modbus/BACnet ports closed at perimeter firewall. Continuing to monitor for further shift.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 4 },
        { type: EntryType.NOTE, body: "Linked to prior DMZ scan case — same campaign, different tool fingerprint. Flagging for CTI review if activity continues.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 12 },
      ],
      iocs: [
        { type: IocType.IP, value: "89.248.167.131", description: "New scan source — shift from prior campaign IPs", confidence: 80, tlp: TLP.GREEN },
        { type: IocType.IP, value: "89.248.160.10", description: "Secondary source from same /16 block", confidence: 70, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1595.001", techniqueName: "Scanning IP Blocks", tactic: "Reconnaissance", description: "Second-wave port scan targeting OT protocol ports" },
      ],
      assets: [
        { hostname: "FW-DMZ-01", ipAddress: "10.200.0.1", os: "FortiOS", assetType: "Firewall", impact: AssetImpact.CLEARED, owner: "Network Ops", description: "DMZ perimeter firewall — OT ports confirmed closed" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 13 — CAT_4 (2nd), HIGH, CLOSED, GREEN
    // -----------------------------------------------------------------------
    {
      title: "Cloud WAF Misconfiguration Exploited — Service Degradation",
      description:
        "An attacker exploited a permissive WAF rule that inadvertently allowed HTTP flood requests through. " +
        "Public-facing API gateway experienced 94% error rate for 31 minutes before rule correction.",
      cat: IncidentCat.CAT_4,
      impactLevel: ImpactLevel.HIGH,
      category: Category.OTHER,
      status: Status.CLOSED,
      tlp: TLP.GREEN,
      assigneeEmail: "cm1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.COUNTERMEASURES],
      teamStatusMap: { SOC: TeamStatus.COMPLETE, COUNTERMEASURES: TeamStatus.COMPLETE },
      blufSummary:
        "A misconfigured WAF allowlist rule permitted high-rate HTTP flood traffic to reach the API gateway. " +
        "Service degradation lasted 31 minutes. Rule corrected by Countermeasures; traffic normalized. " +
        "Post-incident review identified the change that introduced the rule gap. Case closed after 48h of stable monitoring.",
      recommendedActions:
        "1. Implement WAF rule change review gate requiring peer approval before production push.\n" +
        "2. Add rate-limit baseline monitoring alert to detect abnormal request volume within 5 minutes.\n" +
        "3. Schedule quarterly WAF rule audit.",
      createdDaysAgo: 62,
      closedDaysAgo: 55,
      entries: [
        { type: EntryType.NOTE, body: "API gateway error rate spiked to 94% at 11:07 UTC. HTTP flood pattern identified in access logs — 180k req/min from distributed sources.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to Countermeasures — WAF allowlist rule appears to be passing flood traffic. Requesting emergency rule correction.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "WAF rule corrected at 11:38 UTC. Traffic normalized. Root cause: permissive rule deployed in last change window missed rate-limit block.", authorEmail: "cm1@demo.local", team: Team.COUNTERMEASURES, offsetHours: 1 },
        { type: EntryType.NOTE, body: "48h of monitoring confirms stability. Post-incident review documented. Closing.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 49 },
      ],
      iocs: [
        { type: IocType.IP, value: "104.21.0.0", description: "Representative source IP — flood distributed across /16", confidence: 60, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1499.003", techniqueName: "Application Exhaustion Flood", tactic: "Impact", description: "HTTP flood targeting API gateway via misconfigured WAF" },
      ],
      assets: [
        { hostname: "API-GW-PROD", ipAddress: "203.0.113.77", os: "Linux", assetType: "API Gateway", impact: AssetImpact.CONFIRMED, owner: "Platform Engineering", description: "Public API gateway — degraded during WAF misconfiguration window" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 14 — CAT_1, HIGH, CLOSED, RED (linked to Case 1)
    // -----------------------------------------------------------------------
    {
      title: "Vendor VPN Credential Compromise — Trusted Path Exploitation",
      description:
        "A third-party vendor VPN account was compromised and used to access internal segments via trusted network path. " +
        "Actor pivoted to credential storage server within 4 hours of initial access. Linked to prior TEMP.Veles-attributed case.",
      cat: IncidentCat.CAT_1,
      impactLevel: ImpactLevel.HIGH,
      category: Category.INTRUSION,
      status: Status.CLOSED,
      tlp: TLP.RED,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "lead1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR, Team.CTI],
      teamStatusMap: { SOC: TeamStatus.COMPLETE, IR: TeamStatus.COMPLETE, CTI: TeamStatus.COMPLETE },
      blufSummary:
        "Vendor VPN account vendor_svc_02 was compromised and used to access CREDSTORE-01 via the trusted vendor network segment. " +
        "CTI confirmed overlapping IOCs with the TEMP.Veles-attributed Case DCO-linked intrusion. " +
        "Vendor account revoked, CREDSTORE-01 rebuilt from clean image, all credentials rotated. " +
        "Case closed after 5 days of clean monitoring.",
      recommendedActions:
        "1. Require MFA for all vendor VPN accounts immediately.\n" +
        "2. Segment vendor network from credential infrastructure — no direct routing.\n" +
        "3. Audit all vendor VPN accounts and revoke inactive ones.\n" +
        "4. Add CREDSTORE access from vendor subnets as a high-severity SIEM alert.",
      createdDaysAgo: 52,
      closedDaysAgo: 42,
      entries: [
        { type: EntryType.NOTE, body: "VPN authentication alert: vendor_svc_02 logged in from 91.108.4.200 — not a known vendor egress IP. Possible credential compromise.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Vendor account accessing internal segment beyond authorized scope. Escalating IR for immediate investigation.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "IR confirmed access to CREDSTORE-01 from vendor VPN session. 4 service account credential files accessed. Host isolated. Vendor account suspended.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 4 },
        { type: EntryType.ESCALATION, body: "Looping in CTI — source IP 91.108.4.200 may correlate to prior intrusion campaign.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 5 },
        { type: EntryType.NOTE, body: "CTI: 91.108.4.200 is in same ASN block as IOCs from Case DCO linked. High confidence same TEMP.Veles cluster. Full IOC set shared with IR.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 20 },
        { type: EntryType.NOTE, body: "CREDSTORE-01 rebuilt. All accessed credentials rotated. 5 days clean monitoring complete. Closing.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 120 },
      ],
      iocs: [
        { type: IocType.IP, value: "91.108.4.200", description: "Vendor VPN source IP — not in authorized vendor egress list", confidence: 92, tlp: TLP.RED },
        { type: IocType.EMAIL, value: "vendor_svc_02@vendorcorp.com", description: "Compromised vendor service account", confidence: 99, tlp: TLP.RED },
        { type: IocType.DOMAIN, value: "vendorcorp-portal.update-cdn.net", description: "Attacker-registered lookalike domain seen in DNS logs", confidence: 85, tlp: TLP.RED },
      ],
      ttps: [
        { techniqueId: "T1078.004", techniqueName: "Cloud Accounts", tactic: "Initial Access", description: "Compromised vendor VPN service account for trusted network entry" },
        { techniqueId: "T1552.001", techniqueName: "Credentials In Files", tactic: "Credential Access", description: "Credential storage server accessed to harvest service account secrets" },
      ],
      assets: [
        { hostname: "CREDSTORE-01", ipAddress: "10.0.3.5", os: "Linux", assetType: "Credential Storage", impact: AssetImpact.CONFIRMED, owner: "IT Security", description: "Internal credential store — accessed via vendor VPN trust path" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 15 — CAT_7, HIGH, CLOSED, AMBER (linked to Case 7)
    // -----------------------------------------------------------------------
    {
      title: "Ransomware Deployment — Multi-Host Encryption Event",
      description:
        "Ryuk ransomware payload executed across 6 file servers simultaneously. " +
        "Encryption confirmed on 3 hosts before EDR containment. Linked to prior Cobalt Strike beacon case (same C2 infrastructure).",
      cat: IncidentCat.CAT_7,
      impactLevel: ImpactLevel.HIGH,
      category: Category.MALWARE,
      status: Status.CLOSED,
      tlp: TLP.AMBER,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "ir1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR, Team.MALWARE, Team.CTI],
      teamStatusMap: { SOC: TeamStatus.COMPLETE, IR: TeamStatus.COMPLETE, MALWARE: TeamStatus.COMPLETE, CTI: TeamStatus.COMPLETE },
      blufSummary:
        "Ryuk ransomware was deployed across 6 file servers at 02:14 UTC. EDR containment stopped encryption on 3 hosts; " +
        "3 hosts (FILE-SRV-01, -02, -04) suffered partial encryption of non-critical data shares. " +
        "All affected shares restored from backup within 18 hours. The payload was delivered via the Cobalt Strike " +
        "beacon infrastructure identified in DCO linked case — same actor, same C2 watermark. Full remediation complete.",
      recommendedActions:
        "1. Enforce EDR sensor coverage on all file servers — 2 hosts lacked up-to-date sensor at time of attack.\n" +
        "2. Move backups to an isolated network segment with no write access from file server hosts.\n" +
        "3. Deploy canary files on all file shares to provide early encryption detection.\n" +
        "4. Conduct tabletop ransomware exercise within 60 days.",
      createdDaysAgo: 42,
      closedDaysAgo: 25,
      entries: [
        { type: EntryType.NOTE, body: "EDR mass alert at 02:14 UTC — Ryuk IOC pattern across FILE-SRV-01 through FILE-SRV-06. Immediate network isolation of all six hosts initiated.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to Malware Analysis for payload triage and to CTI for threat intel correlation.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 0 },
        { type: EntryType.NOTE, body: "FILE-SRV-01, -02, -04: encryption confirmed on data shares. -03, -05, -06: EDR contained before encryption began. Backups verified intact.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 2 },
        { type: EntryType.NOTE, body: "Payload analysis: Ryuk dropper matches watermark 0x7a4f3b2c from linked CS beacon case. Loader uses same reflective injection technique.", authorEmail: "mal1@demo.local", team: Team.MALWARE, offsetHours: 6 },
        { type: EntryType.NOTE, body: "CTI: payload distribution via CS lateral movement from WS-ENG-14 (linked case). Attack timeline reconstructed. CISA advisory filed.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 12 },
        { type: EntryType.NOTE, body: "All encrypted shares restored from backup. 17h 42m recovery time. All 6 servers reimaged. Clean monitoring 14 days. Closing.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 336 },
      ],
      iocs: [
        { type: IocType.SHA256, value: "d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7", description: "Ryuk dropper binary — matched across all encrypted hosts", confidence: 99, tlp: TLP.AMBER },
        { type: IocType.IP, value: "162.244.83.201", description: "C2 shared with CS beacon case — distribution vector", confidence: 99, tlp: TLP.AMBER },
        { type: IocType.FILE_PATH, value: "C:\\Windows\\Temp\\ryuk_loader.exe", description: "Dropper path consistent across all 6 targets", confidence: 95, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1486", techniqueName: "Data Encrypted for Impact", tactic: "Impact", description: "Ryuk ransomware encryption across file server fleet" },
        { techniqueId: "T1570", techniqueName: "Lateral Tool Transfer", tactic: "Lateral Movement", description: "Ransomware payload distributed via CS beacon lateral movement" },
        { techniqueId: "T1071.004", techniqueName: "DNS", tactic: "Command and Control", description: "CS beacon DNS C2 channel active prior to ransomware deployment" },
      ],
      assets: [
        { hostname: "FILE-SRV-01", ipAddress: "10.0.1.31", os: "Windows Server 2019", assetType: "File Server", impact: AssetImpact.CONFIRMED, owner: "IT Operations", description: "Encrypted — partial data loss, restored from backup" },
        { hostname: "FILE-SRV-02", ipAddress: "10.0.1.32", os: "Windows Server 2019", assetType: "File Server", impact: AssetImpact.CONFIRMED, owner: "IT Operations", description: "Encrypted — partial data loss, restored from backup" },
        { hostname: "FILE-SRV-03", ipAddress: "10.0.1.33", os: "Windows Server 2019", assetType: "File Server", impact: AssetImpact.CLEARED, owner: "IT Operations", description: "Contained before encryption — reimaged as precaution" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 16 — CAT_2, MEDIUM, IN_PROGRESS, AMBER — 2 teams simultaneously ACTIVE
    // -----------------------------------------------------------------------
    {
      title: "OAuth Consent Phishing — Cloud Application Token Theft",
      description:
        "Multiple users authorized a malicious OAuth application disguised as a productivity tool. " +
        "Application obtained read/write access to mailboxes and OneDrive. SOC and IR both actively investigating scope.",
      cat: IncidentCat.CAT_2,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.PHISHING,
      status: Status.IN_PROGRESS,
      tlp: TLP.AMBER,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR],
      teamStatusMap: { SOC: TeamStatus.ACTIVE, IR: TeamStatus.ACTIVE },
      createdDaysAgo: 30,
      entries: [
        { type: EntryType.NOTE, body: "Cloud CASB alert: 14 users granted OAuth permissions to app 'CollabSync Pro' (client_id: 3f92a1b4-...). App not in approved catalog. Permissions: Mail.ReadWrite, Files.ReadWrite.All.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to IR — scope of data access unknown. Requesting token revocation and mailbox audit.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
        { type: EntryType.NOTE, body: "IR: OAuth tokens revoked for all 14 affected users. App blocked in tenant. Mailbox audit in progress — examining sent items and forwarding rules.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 3 },
        { type: EntryType.NOTE, body: "SOC: identified phishing email that distributed the OAuth consent link — sent from compromised external partner account. Notifying partner org.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 8 },
        { type: EntryType.NOTE, body: "IR mailbox audit ongoing — 3 of 14 mailboxes show outbound mail forwarding rules created post-consent. Reviewing forwarded mail content.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 24 },
      ],
      iocs: [
        { type: IocType.URL, value: "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?client_id=3f92a1b4", description: "Malicious OAuth consent URL distributed via phishing", confidence: 97, tlp: TLP.AMBER },
        { type: IocType.DOMAIN, value: "collabsync-pro.app", description: "Attacker-registered OAuth app domain", confidence: 99, tlp: TLP.AMBER },
        { type: IocType.EMAIL, value: "notifications@collabsync-pro.app", description: "OAuth app consent request sender", confidence: 95, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1550.001", techniqueName: "Application Access Token", tactic: "Defense Evasion", description: "OAuth token theft via malicious consent phishing" },
        { techniqueId: "T1114.003", techniqueName: "Email Forwarding Rule", tactic: "Collection", description: "Inbox forwarding rules created post-OAuth compromise" },
      ],
      assets: [
        { hostname: "N/A", assetType: "Cloud Service", impact: AssetImpact.SUSPECTED, owner: "IT Operations", description: "Microsoft 365 tenant — 14 users' mailboxes and OneDrive potentially accessed" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 17 — CAT_6, MEDIUM, IN_PROGRESS, GREEN — 2 teams simultaneously ACTIVE
    // -----------------------------------------------------------------------
    {
      title: "API Endpoint Enumeration and Credential Stuffing Campaign",
      description:
        "Automated credential stuffing campaign targeting the customer-facing API login endpoint. " +
        "48,000 authentication attempts over 90 minutes using a credential list. SOC detecting patterns; " +
        "CTI actively profiling the actor infrastructure.",
      cat: IncidentCat.CAT_6,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.INTRUSION,
      status: Status.IN_PROGRESS,
      tlp: TLP.GREEN,
      classificationCustom: "Custom Label A",
      assigneeEmail: "cti1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.CTI],
      teamStatusMap: { SOC: TeamStatus.ACTIVE, CTI: TeamStatus.ACTIVE },
      blufSummary:
        "A credential stuffing campaign is targeting /api/v2/auth with 48,000 attempts over 90 minutes. " +
        "Rate limiting is now engaged, reducing attempt rate by 92%. CTI has identified the source infrastructure " +
        "as a residential proxy network associated with prior ATO campaigns. " +
        "14 successful authentications confirmed — those accounts force-reset and sessions revoked.",
      recommendedActions:
        "1. Deploy CAPTCHA or device fingerprinting on /api/v2/auth for requests with > 3 failures per session.\n" +
        "2. Integrate HaveIBeenPwned API to proactively identify compromised credential pairs.\n" +
        "3. Enable risk-based authentication for accounts with login anomalies.\n" +
        "4. Request residential proxy block list from threat intel vendor.",
      createdDaysAgo: 22,
      entries: [
        { type: EntryType.NOTE, body: "WAF alert: 48k requests to /api/v2/auth in 90 min from 2,400 unique IPs. Credential stuffing pattern — low per-IP rate to evade blocks. Rate limiting engaged.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to CTI for actor infrastructure profiling. Need to assess whether this is a targeted or opportunistic campaign.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
        { type: EntryType.NOTE, body: "CTI: source IPs match a residential proxy service (AS206092) used in prior ATO campaigns. Credential list likely sourced from recent breach dump.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 4 },
        { type: EntryType.NOTE, body: "SOC confirmed 14 successful authentications from campaign IPs. All 14 accounts force-reset. Sessions revoked. Reviewing account activity during compromise window.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 6 },
        { type: EntryType.NOTE, body: "CTI analysis ongoing: mapping proxy ASN block list for ACL submission. Investigating whether any credential pairs were exfiltrated before blocking.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 18 },
      ],
      iocs: [
        { type: IocType.IP, value: "77.247.110.0", description: "Representative residential proxy source IP — campaign distributed across /16", confidence: 70, tlp: TLP.GREEN },
        { type: IocType.URL, value: "https://api.corp.local/api/v2/auth", description: "Targeted authentication endpoint", confidence: 100, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1110.004", techniqueName: "Credential Stuffing", tactic: "Credential Access", description: "Automated credential stuffing against API auth endpoint using leaked credentials" },
        { techniqueId: "T1589.001", techniqueName: "Gather Victim Identity Information: Credentials", tactic: "Reconnaissance", description: "Pre-attack credential list likely sourced from external breach dump" },
      ],
      assets: [
        { hostname: "API-GW-PROD", ipAddress: "203.0.113.77", os: "Linux", assetType: "API Gateway", impact: AssetImpact.SUSPECTED, owner: "Platform Engineering", description: "Customer-facing API gateway — authentication endpoint targeted" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 18 — CAT_1, HIGH, PENDING_REVIEW, AMBER (linked to Case 16)
    // -----------------------------------------------------------------------
    {
      title: "Kerberoasting Attack — Service Account Credential Extraction",
      description:
        "Active Directory event logs show a spike in Kerberos TGS requests for service accounts from a single workstation. " +
        "Pattern consistent with Kerberoasting — offline hash cracking of service account credentials.",
      cat: IncidentCat.CAT_1,
      impactLevel: ImpactLevel.HIGH,
      category: Category.INTRUSION,
      status: Status.PENDING_REVIEW,
      tlp: TLP.AMBER,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR],
      createdDaysAgo: 16,
      entries: [
        { type: EntryType.NOTE, body: "SIEM: 87 TGS requests for service SPNs from WS-FIN-08 within 4 minutes. Normal baseline is < 3/hour. Kerberoasting pattern confirmed.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to IR — requesting forensic triage of WS-FIN-08 and audit of affected service account usage.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
        { type: EntryType.NOTE, body: "IR: Impacket GetUserSPNs.py artifact found in WS-FIN-08 temp directory. User account on host was compromised via OAuth phishing campaign (linked case).", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 6 },
        { type: EntryType.NOTE, body: "All 87 targeted service account passwords rotated. WS-FIN-08 reimaged. No evidence of successful offline crack — no unusual service account auth observed. Submitting for review.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 48 },
      ],
      iocs: [
        { type: IocType.IP, value: "10.30.1.108", description: "WS-FIN-08 internal IP — Kerberoasting source", confidence: 99, tlp: TLP.AMBER },
        { type: IocType.FILE_PATH, value: "C:\\Users\\finance_user\\AppData\\Local\\Temp\\GetSPNs.py", description: "Impacket Kerberoasting tool artifact", confidence: 98, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1558.003", techniqueName: "Kerberoasting", tactic: "Credential Access", description: "Bulk TGS requests for service account SPN hashes — offline crack attempted" },
        { techniqueId: "T1078", techniqueName: "Valid Accounts", tactic: "Defense Evasion", description: "Kerberoasting objective was to obtain valid service account credentials for further access" },
      ],
      assets: [
        { hostname: "WS-FIN-08", ipAddress: "10.30.1.108", os: "Windows 10", assetType: "Workstation", impact: AssetImpact.CONFIRMED, owner: "Finance", description: "Finance workstation used as Kerberoasting pivot — account compromised via OAuth phishing" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 19 — CAT_4, MEDIUM, NEW, GREEN
    // -----------------------------------------------------------------------
    {
      title: "Suspected BGP Route Hijack — Traffic Redirection Anomaly",
      description:
        "NOC detected anomalous BGP route advertisement for 203.0.113.0/24 originating from an unexpected AS. " +
        "Traffic for the affected prefix was rerouted for approximately 8 minutes before the advertisement was withdrawn.",
      cat: IncidentCat.CAT_4,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.OTHER,
      status: Status.NEW,
      tlp: TLP.GREEN,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC],
      createdDaysAgo: 11,
      entries: [
        { type: EntryType.NOTE, body: "NOC BGP alert at 16:43 UTC: prefix 203.0.113.0/24 re-advertised by AS64500 — not our upstream. BGP Looking Glass confirms reroute was active for ~8 minutes.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "Route withdrawn by 16:51 UTC. Traffic logs during reroute window being analyzed for anomalous destinations or session interception evidence.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
      ],
      iocs: [
        { type: IocType.IP, value: "203.0.113.0", description: "Affected prefix — unauthorized BGP advertisement source", confidence: 80, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1557.003", techniqueName: "DHCP Spoofing", tactic: "Collection", description: "BGP route hijack for potential traffic interception during 8-minute window" },
      ],
      assets: [
        { hostname: "BGP-EDGE-01", ipAddress: "10.0.0.1", os: "Cisco IOS XR", assetType: "Border Router", impact: AssetImpact.SUSPECTED, owner: "Network Ops", description: "Border router — prefix 203.0.113.0/24 hijacked from this AS" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 20 — CAT_7, LOW, IN_PROGRESS, GREEN
    // -----------------------------------------------------------------------
    {
      title: "Cryptominer Deployed on Cloud Compute Instances",
      description:
        "Three AWS EC2 instances in the dev environment were found running XMRig cryptominer. " +
        "Likely entry via exposed debug port. Instances terminated and replaced. Scope investigation ongoing.",
      cat: IncidentCat.CAT_7,
      impactLevel: ImpactLevel.LOW,
      category: Category.MALWARE,
      status: Status.IN_PROGRESS,
      tlp: TLP.GREEN,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR],
      createdDaysAgo: 6,
      entries: [
        { type: EntryType.NOTE, body: "AWS CloudWatch: dev-worker-03, -07, -11 showing sustained 95%+ CPU. Process inspection via SSM: xmrig process running under www-data. Terminated immediately.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to IR — reviewing entry vector. Debug port 9229 was exposed to 0.0.0.0 in last terraform apply.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "IR confirmed: Node.js debug port 9229 exposed publicly. Attacker likely used --inspect exploit to achieve RCE. Checking all dev instances for similar exposure.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 3 },
        { type: EntryType.NOTE, body: "Audit complete: 8 additional dev instances had port 9229 exposed. All remediated. Security group rules tightened. Mining pool address identified.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 12 },
      ],
      iocs: [
        { type: IocType.DOMAIN, value: "pool.minexmr.com", description: "XMRig mining pool target domain", confidence: 99, tlp: TLP.GREEN },
        { type: IocType.SHA256, value: "e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8", description: "XMRig binary hash found on affected instances", confidence: 97, tlp: TLP.GREEN },
        { type: IocType.IP, value: "194.165.16.10", description: "Mining pool IP resolved from pool.minexmr.com", confidence: 90, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1496", techniqueName: "Resource Hijacking", tactic: "Impact", description: "XMRig cryptominer deployed on cloud compute instances" },
        { techniqueId: "T1190", techniqueName: "Exploit Public-Facing Application", tactic: "Initial Access", description: "Node.js debug port (9229) exposed publicly — RCE used for initial access" },
      ],
      assets: [
        { hostname: "dev-worker-03", ipAddress: "172.31.10.3", os: "Ubuntu 22.04", assetType: "Cloud Instance", impact: AssetImpact.CONFIRMED, owner: "Development", description: "AWS EC2 dev instance — cryptominer confirmed, terminated and replaced" },
        { hostname: "dev-worker-07", ipAddress: "172.31.10.7", os: "Ubuntu 22.04", assetType: "Cloud Instance", impact: AssetImpact.CONFIRMED, owner: "Development", description: "AWS EC2 dev instance — cryptominer confirmed, terminated and replaced" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 21 — CAT_2, HIGH, CLOSED, RED (365 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Ransomware Outbreak - Production Systems",
      description:
        "Widespread ransomware deployment across production file servers. " +
        "Encryption confirmed on 12 hosts. Recovery from backups completed. Attribution to criminal affiliate group.",
      cat: IncidentCat.CAT_2,
      impactLevel: ImpactLevel.HIGH,
      category: Category.MALWARE,
      status: Status.CLOSED,
      tlp: TLP.RED,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "ir1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR, Team.MALWARE, Team.CTI],
      teamStatusMap: { SOC: TeamStatus.COMPLETE, IR: TeamStatus.COMPLETE, MALWARE: TeamStatus.COMPLETE, CTI: TeamStatus.COMPLETE },
      createdDaysAgo: 365,
      closedDaysAgo: 340,
      attackVector: AttackVector.PHISHING,
      affectedNetwork: "Network-A",
      detectionSource: "Endpoint-Detection-Tool",
      missionImpact: MissionImpact.MISSION_FAILURE,
      reportingRequired: true,
      entries: [
        { type: EntryType.NOTE, body: "Mass EDR alerts on ransomware encryption activity across production file server fleet. All hosts isolated.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to Malware and CTI. Encryption active on 12 hosts. Backups verified intact.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 1 },
        { type: EntryType.NOTE, body: "Malware analysis: ransomware variant identified. Decryption not feasible. Recovery from backup initiated.", authorEmail: "mal1@demo.local", team: Team.MALWARE, offsetHours: 8 },
        { type: EntryType.NOTE, body: "All systems restored from backup. Full recovery in 72h. Reporting filed. Closing.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 600 },
      ],
      iocs: [
        { type: IocType.SHA256, value: "f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2", description: "Ransomware binary recovered from host memory", confidence: 99, tlp: TLP.RED },
        { type: IocType.IP, value: "185.220.101.100", description: "C2 IP observed during encryption event", confidence: 85, tlp: TLP.RED },
      ],
      ttps: [
        { techniqueId: "T1486", techniqueName: "Data Encrypted for Impact", tactic: "Impact", description: "Mass file encryption across production fleet" },
        { techniqueId: "T1490", techniqueName: "Inhibit System Recovery", tactic: "Impact", description: "Shadow copy deletion attempted prior to encryption" },
      ],
      assets: [
        { hostname: "FILE-PROD-01", ipAddress: "10.0.2.10", os: "Windows Server 2019", assetType: "File Server", impact: AssetImpact.CONFIRMED, owner: "IT Operations", description: "Primary production file server — encrypted, restored from backup" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 22 — CAT_1, HIGH, CLOSED, AMBER (240 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Spear Phishing Campaign - Executive Targets",
      description:
        "Targeted spear phishing campaign against executive leadership. " +
        "Three accounts compromised. Credential harvesting and email access confirmed.",
      cat: IncidentCat.CAT_1,
      impactLevel: ImpactLevel.HIGH,
      category: Category.PHISHING,
      status: Status.CLOSED,
      tlp: TLP.AMBER,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR, Team.CTI],
      teamStatusMap: { SOC: TeamStatus.COMPLETE, IR: TeamStatus.COMPLETE, CTI: TeamStatus.COMPLETE },
      createdDaysAgo: 240,
      closedDaysAgo: 220,
      attackVector: AttackVector.PHISHING,
      affectedNetwork: "Network-B",
      detectionSource: "SIEM-Alpha",
      missionImpact: MissionImpact.DEGRADED,
      reportingRequired: true,
      entries: [
        { type: EntryType.NOTE, body: "Phishing emails targeting VP-level accounts. Three accounts confirmed compromised. Credentials reset immediately.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to IR and CTI for scope assessment and attribution.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
        { type: EntryType.NOTE, body: "IR: All compromised accounts contained. No lateral movement. Email forwarding rules removed.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 6 },
        { type: EntryType.NOTE, body: "CTI: Campaign attributed to known financial threat actor. IOCs shared with sector ISAC. Closing.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 72 },
      ],
      iocs: [
        { type: IocType.DOMAIN, value: "exec-portal-secure.net", description: "Phishing domain targeting executives", confidence: 95, tlp: TLP.AMBER },
        { type: IocType.URL, value: "https://exec-portal-secure.net/auth/login", description: "Credential harvest landing page", confidence: 98, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1566.001", techniqueName: "Spearphishing Attachment", tactic: "Initial Access", description: "Targeted spear phishing with credential harvest link" },
        { techniqueId: "T1078", techniqueName: "Valid Accounts", tactic: "Defense Evasion", description: "Compromised executive credentials used for email access" },
      ],
      assets: [
        { hostname: "N/A", assetType: "Cloud Service", impact: AssetImpact.CONFIRMED, owner: "Executive Leadership", description: "Microsoft 365 executive accounts — compromised and remediated" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 23 — CAT_4, MEDIUM, CLOSED, GREEN (180 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Firewall Rule Misconfiguration",
      description:
        "Perimeter firewall misconfiguration inadvertently exposed internal services to the internet. " +
        "No exploitation confirmed. Configuration corrected within 4 hours of detection.",
      cat: IncidentCat.CAT_4,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.NONCOMPLIANCE,
      status: Status.CLOSED,
      tlp: TLP.GREEN,
      assigneeEmail: "cm1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.COUNTERMEASURES],
      teamStatusMap: { SOC: TeamStatus.COMPLETE, COUNTERMEASURES: TeamStatus.COMPLETE },
      createdDaysAgo: 180,
      closedDaysAgo: 175,
      attackVector: AttackVector.WEB_APPLICATION,
      affectedNetwork: "Network-A",
      detectionSource: "Firewall-Monitor",
      missionImpact: MissionImpact.NONE,
      entries: [
        { type: EntryType.NOTE, body: "External scan detected internal management port (8443) accessible from internet. Firewall rule error identified.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to Countermeasures for immediate rule correction.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "Firewall rule corrected. Access logs reviewed — no exploitation observed during exposure window. Closing.", authorEmail: "cm1@demo.local", team: Team.COUNTERMEASURES, offsetHours: 4 },
      ],
      iocs: [],
      ttps: [
        { techniqueId: "T1190", techniqueName: "Exploit Public-Facing Application", tactic: "Initial Access", description: "Misconfigured firewall exposed management interface — no exploitation confirmed" },
      ],
      assets: [
        { hostname: "FW-PERIMETER-01", ipAddress: "198.51.100.1", os: "FortiOS", assetType: "Firewall", impact: AssetImpact.CLEARED, owner: "Network Ops", description: "Perimeter firewall with misconfigured rule — corrected" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 24 — CAT_7, LOW, CLOSED, GREEN (120 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Cryptominer Detection - Endpoint",
      description:
        "Cryptominer detected on a developer workstation. " +
        "Likely introduced via malicious npm package. Host reimaged. No lateral movement.",
      cat: IncidentCat.CAT_7,
      impactLevel: ImpactLevel.LOW,
      category: Category.MALWARE,
      status: Status.CLOSED,
      tlp: TLP.GREEN,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR],
      teamStatusMap: { SOC: TeamStatus.COMPLETE, IR: TeamStatus.COMPLETE },
      createdDaysAgo: 120,
      closedDaysAgo: 115,
      attackVector: AttackVector.WEB_APPLICATION,
      affectedNetwork: "Network-B",
      detectionSource: "Endpoint-Detection-Tool",
      missionImpact: MissionImpact.NONE,
      entries: [
        { type: EntryType.NOTE, body: "EDR alert on XMRig process on developer workstation WS-DEV-45. Process terminated and host isolated.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to IR for root cause analysis.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "IR: malicious npm package in recent install identified as infection vector. Host reimaged. No evidence of lateral movement. Closing.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 8 },
      ],
      iocs: [
        { type: IocType.DOMAIN, value: "pool.hashvault.pro", description: "Cryptominer pool domain", confidence: 95, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1496", techniqueName: "Resource Hijacking", tactic: "Impact", description: "Cryptominer on developer workstation via malicious package" },
      ],
      assets: [
        { hostname: "WS-DEV-45", ipAddress: "10.20.5.45", os: "Ubuntu 22.04", assetType: "Workstation", impact: AssetImpact.CONFIRMED, owner: "Development", description: "Developer workstation — cryptominer confirmed, reimaged" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 25 — CAT_1, HIGH, IN_PROGRESS, RED (75 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Advanced Persistent Threat - Network Intrusion",
      description:
        "Sophisticated intrusion detected with indicators consistent with state-sponsored APT activity. " +
        "Persistent access confirmed on three hosts. Ongoing investigation and containment.",
      cat: IncidentCat.CAT_1,
      impactLevel: ImpactLevel.HIGH,
      category: Category.INTRUSION,
      status: Status.IN_PROGRESS,
      tlp: TLP.RED,
      assigneeEmail: "ir1@demo.local",
      creatorEmail: "lead1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR, Team.CTI, Team.MALWARE],
      teamStatusMap: { SOC: TeamStatus.PENDING, IR: TeamStatus.ACTIVE, CTI: TeamStatus.ACTIVE, MALWARE: TeamStatus.PENDING },
      createdDaysAgo: 75,
      attackVector: AttackVector.CREDENTIAL_COMPROMISE,
      affectedNetwork: "Network-A",
      detectionSource: "SIEM-Alpha",
      missionImpact: MissionImpact.DEGRADED,
      reportingRequired: true,
      entries: [
        { type: EntryType.NOTE, body: "Anomalous authentication pattern from privileged account outside normal hours. Possible credential compromise.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to IR — pattern consistent with APT lateral movement. Three hosts show signs of persistent access.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 2 },
        { type: EntryType.ESCALATION, body: "Looping in CTI for attribution analysis and Malware for implant triage.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 4 },
        { type: EntryType.NOTE, body: "CTI: TTPs match known APT cluster. Custom implant identified. Attribution assessment in progress.", authorEmail: "cti1@demo.local", team: Team.CTI, offsetHours: 24 },
        { type: EntryType.NOTE, body: "IR: three hosts confirmed with persistent access. Containment in progress. Network segmentation applied.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 48 },
      ],
      iocs: [
        { type: IocType.IP, value: "45.142.212.200", description: "APT C2 infrastructure — confirmed malicious", confidence: 92, tlp: TLP.RED },
        { type: IocType.SHA256, value: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2", description: "Custom implant binary recovered from compromised host", confidence: 97, tlp: TLP.RED },
      ],
      ttps: [
        { techniqueId: "T1078", techniqueName: "Valid Accounts", tactic: "Defense Evasion", description: "Compromised privileged credentials for persistent access" },
        { techniqueId: "T1027", techniqueName: "Obfuscated Files or Information", tactic: "Defense Evasion", description: "Custom implant with obfuscated payload" },
        { techniqueId: "T1059.001", techniqueName: "PowerShell", tactic: "Execution", description: "PowerShell used for post-exploitation enumeration and lateral movement" },
        { techniqueId: "T1071.004", techniqueName: "DNS", tactic: "Command and Control", description: "Custom implant uses DNS for covert C2 channel" },
      ],
      assets: [
        { hostname: "SRV-CORP-01", ipAddress: "10.0.3.10", os: "Windows Server 2022", assetType: "Server", impact: AssetImpact.CONFIRMED, owner: "IT Operations", description: "Corporate server — persistent APT access confirmed" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 26 — CAT_2, MEDIUM, IN_PROGRESS, AMBER (60 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Business Email Compromise Attempt",
      description:
        "Business email compromise attempt targeting finance department. " +
        "Fraudulent wire transfer request intercepted before processing. Account investigation ongoing.",
      cat: IncidentCat.CAT_2,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.PHISHING,
      status: Status.IN_PROGRESS,
      tlp: TLP.AMBER,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.IR],
      createdDaysAgo: 60,
      attackVector: AttackVector.PHISHING,
      affectedNetwork: "Network-B",
      detectionSource: "SIEM-Alpha",
      missionImpact: MissionImpact.NONE,
      entries: [
        { type: EntryType.NOTE, body: "Finance reported suspicious wire transfer request from apparent CFO email. BEC pattern identified — lookalike domain used.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to IR — confirming whether CFO account is compromised.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
        { type: EntryType.NOTE, body: "IR: CFO account not compromised — email spoofed via lookalike domain. Transfer blocked. Domain submitted for takedown.", authorEmail: "ir1@demo.local", team: Team.IR, offsetHours: 4 },
      ],
      iocs: [
        { type: IocType.DOMAIN, value: "corp-finance-secure.net", description: "BEC lookalike domain used for spoofing", confidence: 98, tlp: TLP.AMBER },
        { type: IocType.EMAIL, value: "cfo@corp-finance-secure.net", description: "Spoofed CFO address used in BEC attempt", confidence: 99, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1566.003", techniqueName: "Spearphishing via Service", tactic: "Initial Access", description: "Business email compromise via lookalike domain spoofing" },
      ],
      assets: [],
    },

    // -----------------------------------------------------------------------
    // Case 27 — CAT_6, MEDIUM, PENDING_REVIEW, GREEN (45 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Vulnerability Scan Finding - Critical CVE",
      description:
        "Internal vulnerability scan identified a critical unpatched CVE on a publicly accessible service. " +
        "Patch applied. Verification scan pending.",
      cat: IncidentCat.CAT_6,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.VULNERABILITY,
      status: Status.PENDING_REVIEW,
      tlp: TLP.GREEN,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC, Team.COUNTERMEASURES],
      createdDaysAgo: 45,
      attackVector: AttackVector.WEB_APPLICATION,
      affectedNetwork: "Network-A",
      detectionSource: "Firewall-Monitor",
      missionImpact: MissionImpact.NONE,
      entries: [
        { type: EntryType.NOTE, body: "Vulnerability scanner flagged CVSSv3 9.8 vulnerability on public-facing API service. Patch available. No exploitation indicators.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.ESCALATION, body: "Escalating to Countermeasures for emergency patch coordination.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "Patch applied in emergency change window. Verification scan queued. Submitting for review.", authorEmail: "cm1@demo.local", team: Team.COUNTERMEASURES, offsetHours: 8 },
      ],
      iocs: [],
      ttps: [
        { techniqueId: "T1190", techniqueName: "Exploit Public-Facing Application", tactic: "Initial Access", description: "Critical CVE on public API — patched before exploitation" },
      ],
      assets: [
        { hostname: "API-PUBLIC-01", ipAddress: "203.0.113.80", os: "Linux", assetType: "API Server", impact: AssetImpact.CLEARED, owner: "Platform Engineering", description: "Public API service with critical CVE — patched" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 28 — CAT_3, LOW, IN_PROGRESS, GREEN (15 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Unauthorized Wireless Access Point",
      description:
        "Unauthorized wireless access point detected on the corporate network segment. " +
        "Device physically located and removed. Network access logs under review.",
      cat: IncidentCat.CAT_3,
      impactLevel: ImpactLevel.LOW,
      category: Category.NONCOMPLIANCE,
      status: Status.IN_PROGRESS,
      tlp: TLP.GREEN,
      assigneeEmail: "soc1@demo.local",
      creatorEmail: "soc2@demo.local",
      teamsInvolved: [Team.SOC],
      createdDaysAgo: 15,
      attackVector: AttackVector.PHYSICAL,
      affectedNetwork: "Network-B",
      detectionSource: "Firewall-Monitor",
      missionImpact: MissionImpact.NONE,
      entries: [
        { type: EntryType.NOTE, body: "Wireless IDS detected unauthorized SSID broadcast on corporate frequency. Device MAC address traced to floor 3 server closet.", authorEmail: "soc2@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "Rogue AP physically located and removed. Reviewing DHCP logs to identify any connected clients during exposure window.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 4 },
      ],
      iocs: [
        { type: IocType.OTHER, value: "00:11:22:33:44:55", description: "MAC address of unauthorized access point", confidence: 100, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1200", techniqueName: "Hardware Additions", tactic: "Initial Access", description: "Unauthorized wireless AP connected to corporate network" },
      ],
      assets: [
        { hostname: "ROGUE-AP-01", assetType: "Wireless AP", impact: AssetImpact.CLEARED, owner: "Unknown", description: "Unauthorized wireless access point — removed from network" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 29 — CAT_1, HIGH, NEW, AMBER (8 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Lateral Movement Detected - Active Directory",
      description:
        "Suspicious Kerberos ticket requests and LDAP enumeration detected from a workstation. " +
        "Pattern consistent with active lateral movement within Active Directory environment.",
      cat: IncidentCat.CAT_1,
      impactLevel: ImpactLevel.HIGH,
      category: Category.INTRUSION,
      status: Status.NEW,
      tlp: TLP.AMBER,
      assigneeEmail: "ir2@demo.local",
      creatorEmail: "soc1@demo.local",
      teamsInvolved: [Team.SOC],
      createdDaysAgo: 8,
      attackVector: AttackVector.CREDENTIAL_COMPROMISE,
      affectedNetwork: "Network-A",
      detectionSource: "SIEM-Alpha",
      missionImpact: MissionImpact.UNKNOWN,
      entries: [
        { type: EntryType.NOTE, body: "SIEM alert: anomalous Kerberos TGS requests and LDAP queries from WS-HR-12. Pattern consistent with AD enumeration and lateral movement preparation.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "WS-HR-12 isolated pending IR triage. Reviewing authentication logs for scope.", authorEmail: "soc1@demo.local", team: Team.SOC, offsetHours: 1 },
      ],
      iocs: [
        { type: IocType.IP, value: "10.30.2.112", description: "Source workstation IP for AD enumeration activity", confidence: 90, tlp: TLP.AMBER },
      ],
      ttps: [
        { techniqueId: "T1018", techniqueName: "Remote System Discovery", tactic: "Discovery", description: "Active Directory enumeration via LDAP queries" },
        { techniqueId: "T1558.003", techniqueName: "Kerberoasting", tactic: "Credential Access", description: "Anomalous Kerberos TGS requests suggesting Kerberoasting attempt" },
      ],
      assets: [
        { hostname: "WS-HR-12", ipAddress: "10.30.2.112", os: "Windows 10", assetType: "Workstation", impact: AssetImpact.SUSPECTED, owner: "HR", description: "HR workstation isolated for lateral movement investigation" },
      ],
    },

    // -----------------------------------------------------------------------
    // Case 30 — CAT_2, MEDIUM, NEW, GREEN (3 days ago)
    // -----------------------------------------------------------------------
    {
      title: "Suspicious Outbound DNS Traffic",
      description:
        "Unusual DNS query patterns detected from multiple internal hosts. " +
        "High-frequency queries to uncommon TLDs suggestive of DNS tunneling or C2 beaconing.",
      cat: IncidentCat.CAT_2,
      impactLevel: ImpactLevel.MEDIUM,
      category: Category.ANOMALOUS_ACTIVITY,
      status: Status.NEW,
      tlp: TLP.GREEN,
      assigneeEmail: "soc2@demo.local",
      creatorEmail: "soc2@demo.local",
      teamsInvolved: [Team.SOC],
      createdDaysAgo: 3,
      attackVector: AttackVector.UNKNOWN,
      affectedNetwork: "Network-B",
      detectionSource: "Firewall-Monitor",
      missionImpact: MissionImpact.UNKNOWN,
      entries: [
        { type: EntryType.NOTE, body: "DNS monitoring alert: multiple hosts generating high-frequency queries to *.xyz and *.pw TLDs. Query pattern consistent with DNS tunneling.", authorEmail: "soc2@demo.local", team: Team.SOC, offsetHours: 0 },
        { type: EntryType.NOTE, body: "Blocking suspicious TLDs at perimeter DNS resolver. Capturing DNS traffic for analysis. Three hosts identified as primary sources.", authorEmail: "soc2@demo.local", team: Team.SOC, offsetHours: 2 },
      ],
      iocs: [
        { type: IocType.DOMAIN, value: "data-exfil.suspicious.xyz", description: "High-frequency DNS query target — tunneling suspected", confidence: 70, tlp: TLP.GREEN },
        { type: IocType.IP, value: "10.0.5.23", description: "Internal host generating anomalous DNS traffic", confidence: 85, tlp: TLP.GREEN },
      ],
      ttps: [
        { techniqueId: "T1071.004", techniqueName: "DNS", tactic: "Command and Control", description: "High-frequency DNS queries to uncommon TLDs — tunneling suspected" },
      ],
      assets: [
        { hostname: "WS-IT-23", ipAddress: "10.0.5.23", os: "Windows 11", assetType: "Workstation", impact: AssetImpact.SUSPECTED, owner: "IT Operations", description: "Primary source of anomalous DNS traffic — under investigation" },
      ],
    },
  ];
}

async function seedDemoCases(
  adminId: string,
  userIds: Record<string, string>
): Promise<{ cases: number; entries: number; iocs: number; ttps: number; assets: number; caseIds: string[] }> {
  const caseDefs = buildCases(userIds);
  let caseCount = 0;
  let entryCount = 0;
  let iocCount = 0;
  let ttpCount = 0;
  let assetCount = 0;
  const caseIds: string[] = [];

  for (const def of caseDefs) {
    const baseDate = daysAgo(def.createdDaysAgo);

    const caseRecord = await prisma.$transaction(
      async (tx) => {
        const caseId = await generateCaseId(tx);
        const assigneeId = userIds[def.assigneeEmail];
        const creatorId = userIds[def.creatorEmail] ?? adminId;

        return tx.case.create({
          data: {
            caseId,
            title: def.title,
            description: def.description,
            cat: def.cat,
            impactLevel: def.impactLevel,
            category: def.category,
            status: def.status,
            tlp: def.tlp,
            createdById: creatorId,
            assignedToId: assigneeId,
            teamsInvolved: def.teamsInvolved,
            classificationCustom: def.classificationCustom ?? null,
            blufSummary: def.blufSummary ?? null,
            recommendedActions: def.recommendedActions ?? null,
            incidentStartedAt:  def.incidentStartedAt  ? new Date(def.incidentStartedAt)  : null,
            incidentDetectedAt: def.incidentDetectedAt ? new Date(def.incidentDetectedAt) : null,
            detectionSource:    def.detectionSource    ?? null,
            attackVector:       def.attackVector       ?? null,
            affectedNetwork:    def.affectedNetwork    ?? null,
            missionImpact:      def.missionImpact      ?? null,
            reportingRequired:  def.reportingRequired  ?? false,
            createdAt: baseDate,
            updatedAt: baseDate,
            closedAt: def.closedDaysAgo != null ? daysAgo(def.closedDaysAgo) : null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    caseIds.push(caseRecord.id);
    caseCount++;

    // Entries
    for (const e of def.entries) {
      const authorId = userIds[e.authorEmail] ?? adminId;
      const entryDate = new Date(baseDate.getTime() + e.offsetHours * 3600 * 1000);
      await prisma.caseEntry.create({
        data: {
          caseId: caseRecord.id,
          authorId,
          authorTeam: e.team,
          entryType: e.type,
          body: e.body,
          createdAt: entryDate,
        },
      });
      entryCount++;
    }

    // IOCs
    const creatorId = userIds[def.creatorEmail] ?? adminId;
    for (const ioc of def.iocs) {
      await prisma.ioc.create({
        data: {
          caseId: caseRecord.id,
          type: ioc.type,
          value: ioc.value,
          description: ioc.description ?? null,
          confidence: ioc.confidence,
          tlp: ioc.tlp,
          addedById: creatorId,
          createdAt: baseDate,
        },
      });
      iocCount++;
    }

    // TTPs
    for (const ttp of def.ttps) {
      await prisma.ttp.create({
        data: {
          caseId: caseRecord.id,
          techniqueId: ttp.techniqueId,
          techniqueName: ttp.techniqueName,
          tactic: ttp.tactic,
          description: ttp.description ?? null,
          addedById: creatorId,
          createdAt: baseDate,
        },
      });
      ttpCount++;
    }

    // Assets
    for (const asset of def.assets) {
      await prisma.asset.create({
        data: {
          caseId: caseRecord.id,
          hostname: asset.hostname ?? null,
          ipAddress: asset.ipAddress ?? null,
          os: asset.os ?? null,
          assetType: asset.assetType ?? null,
          impact: asset.impact,
          owner: asset.owner ?? null,
          description: asset.description ?? null,
          addedById: creatorId,
          createdAt: baseDate,
        },
      });
      assetCount++;
    }

    // CaseTeamStatus — derive from teamStatusMap or auto-generate
    for (const team of def.teamsInvolved) {
      let status: TeamStatus;
      if (def.teamStatusMap && def.teamStatusMap[team] !== undefined) {
        status = def.teamStatusMap[team]!;
      } else if (def.status === Status.CLOSED) {
        status = TeamStatus.COMPLETE;
      } else {
        // Last team in list → ACTIVE; prior teams → PENDING
        const idx = def.teamsInvolved.indexOf(team);
        status = idx === def.teamsInvolved.length - 1 ? TeamStatus.ACTIVE : TeamStatus.PENDING;
      }
      await prisma.caseTeamStatus.create({
        data: {
          caseId:      caseRecord.id,
          team,
          status,
          updatedById: creatorId,
        },
      });
    }
  }

  // Case links (0-indexed):
  //   [0,8]  = Case 1 ↔ Case 9   (TEMP.Veles credential theft → lateral movement)
  //   [6,9]  = Case 7 ↔ Case 10  (CS beacon → ransomware staging)
  //   [5,11] = Case 6 ↔ Case 12  (DMZ recon → second scan wave)
  //   [0,13] = Case 1 ↔ Case 14  (TEMP.Veles actor — vendor VPN follow-on)
  //   [6,14] = Case 7 ↔ Case 15  (CS beacon → full ransomware deployment)
  //   [15,17]= Case 16 ↔ Case 18 (OAuth phishing → Kerberoasting)
  const linkPairs: [number, number, string][] = [
    [0,  8,  "Same actor — credential theft enabled lateral movement in linked case"],
    [6,  9,  "Cobalt Strike beacon preceded ransomware staging — same actor, same C2"],
    [5,  11, "Coordinated scan campaign — second wave linked to initial DMZ recon case"],
    [0,  13, "TEMP.Veles actor — vendor VPN compromise follows same campaign as initial service account intrusion"],
    [6,  14, "CS beacon (Case 7) was the initial access vector that led to full ransomware deployment"],
    [15, 17, "Compromised OAuth token (Case 16) used to access workstation where Kerberoasting was launched"],
  ];

  for (const [a, b, note] of linkPairs) {
    if (caseIds[a] && caseIds[b]) {
      await prisma.caseLink.create({
        data: { sourceCaseId: caseIds[a], targetCaseId: caseIds[b], note },
      });
    }
  }

  return { cases: caseCount, entries: entryCount, iocs: iocCount, ttps: ttpCount, assets: assetCount, caseIds };
}

// ---------------------------------------------------------------------------
// Demo notifications
// ---------------------------------------------------------------------------
async function seedDemoNotifications(adminId: string, caseIds: string[]): Promise<void> {
  // Only seed if the admin has no notifications yet (idempotent)
  const existing = await prisma.notification.count({ where: { targetUserId: adminId } });
  if (existing > 0) return;

  const [case1Id, case2Id, case3Id] = caseIds;
  if (!case1Id || !case2Id || !case3Id) return;

  await prisma.notification.createMany({
    data: [
      {
        caseId:      case1Id,
        targetTeam:  Team.SOC,
        targetUserId: adminId,
        message:     "SOC team escalated this case to IR for malware analysis.",
        isRead:      false,
      },
      {
        caseId:      case2Id,
        targetTeam:  Team.SOC,
        targetUserId: adminId,
        message:     "This case has been assigned to you for review.",
        isRead:      false,
      },
      {
        caseId:      case3Id,
        targetTeam:  Team.SOC,
        targetUserId: adminId,
        message:     "IR team returned this case requesting additional evidence collection.",
        isRead:      false,
      },
    ],
  });
  console.log("[seed] Created 3 demo notifications for admin.");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  await seedAdmin();

  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    console.log("[seed] NEXT_PUBLIC_DEMO_MODE not set — skipping demo data.");
    return;
  }

  // Check sentinel
  const sentinel = await prisma.case.findFirst({ where: { title: SENTINEL_TITLE } });
  if (sentinel) {
    console.log("[seed] Demo data already present — skipping.");
    return;
  }

  console.log("[seed] Seeding demo users...");
  const userIds = await seedDemoUsers();
  const createdUserCount = Object.keys(userIds).length;

  // Get admin id for fallback
  const adminEmail = process.env.SEED_ADMIN_EMAIL!;
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  const adminId = adminUser!.id;

  console.log("[seed] Seeding demo cases...");
  const counts = await seedDemoCases(adminId, userIds);

  console.log("[seed] Seeding demo notifications...");
  await seedDemoNotifications(adminId, counts.caseIds);

  console.log(
    `[seed] Done. Users: ${createdUserCount} | Cases: ${counts.cases} | ` +
    `Entries: ${counts.entries} | IOCs: ${counts.iocs} | TTPs: ${counts.ttps} | Assets: ${counts.assets}`
  );
}

main()
  .catch((err) => {
    console.error("[seed] Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
