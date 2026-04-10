import { Team, Role } from "@prisma/client";

// ---------------------------------------------------------------------------
// Team display label — Option 2 decision (2026-04-09)
//
// CaseEntry.authorTeam is a non-nullable Team enum. ADMIN users have no team,
// so we store a placeholder ("SOC") in the DB. The display layer checks
// author.role and overrides the label with "ADMIN" when appropriate.
// ---------------------------------------------------------------------------
export type TeamDisplay = Team | "ADMIN";

export function getAuthorTeamDisplay(
  authorTeam: Team,
  authorRole: Role
): TeamDisplay {
  if (authorRole === Role.ADMIN) return "ADMIN";
  return authorTeam;
}

// Color classes for team labels (Tailwind)
export const TEAM_COLORS: Record<TeamDisplay, { text: string; bg: string; border: string; leftBorder: string }> = {
  SOC:              { text: "text-blue-300",    bg: "bg-blue-950",    border: "border-blue-800",    leftBorder: "border-l-blue-500"    },
  IR:               { text: "text-orange-300",  bg: "bg-orange-950",  border: "border-orange-800",  leftBorder: "border-l-orange-500"  },
  MALWARE:          { text: "text-purple-300",  bg: "bg-purple-950",  border: "border-purple-800",  leftBorder: "border-l-purple-500"  },
  CTI:              { text: "text-green-300",   bg: "bg-green-950",   border: "border-green-800",   leftBorder: "border-l-green-500"   },
  COUNTERMEASURES:  { text: "text-red-300",     bg: "bg-red-950",     border: "border-red-800",     leftBorder: "border-l-red-500"     },
  ADMIN:            { text: "text-neutral-400", bg: "bg-neutral-800", border: "border-neutral-700", leftBorder: "border-l-neutral-600" },
};

export const TEAM_LABEL: Record<TeamDisplay, string> = {
  SOC:             "SOC",
  IR:              "IR",
  MALWARE:         "MALWARE",
  CTI:             "CTI",
  COUNTERMEASURES: "CNTM", // CM is ambiguous with Case Management
  ADMIN:           "ADMIN",
};
