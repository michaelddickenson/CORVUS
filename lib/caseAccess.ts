import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

/**
 * Shared case access check for all case sub-resource routes.
 * Returns the minimal case fields needed, plus an `allowed` flag.
 * All authenticated users have access to all cases — classification is display-only.
 */
export async function getCaseAccess(caseId: string, session: Session) {
  void session; // session is kept as param for API compatibility
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      caseId:       true,
      title:        true,
      tlp:          true,
      teamsInvolved: true,
      createdById:  true,
      assignedToId: true,
    },
  });
  if (!c) return { c: null, allowed: false as const };
  return { c, allowed: true as const };
}
