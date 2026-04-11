import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

/**
 * Shared case access check for all case sub-resource routes.
 * Returns the minimal case fields needed, plus access flags.
 *
 * allowed  — case exists and session user may see it (TLP:RED gate)
 * canWrite — user may perform write operations on this case
 *            false for OBSERVER unless they have a WRITE CasePermission
 */
export async function getCaseAccess(caseId: string, session: Session) {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      caseId:        true,
      title:         true,
      tlp:           true,
      teamsInvolved: true,
      createdById:   true,
      assignedToId:  true,
    },
  });
  if (!c) return { c: null, allowed: false as const, canWrite: false };

  // TLP:RED gate — only creator, assignee, involved team member, or ADMIN may see
  if (c.tlp === "RED") {
    const isAdmin   = session.user.role === "ADMIN";
    const isCreator = c.createdById   === session.user.id;
    const isAssignee = c.assignedToId === session.user.id;
    const onTeam    = session.user.team != null && c.teamsInvolved.includes(session.user.team as never);

    if (!isAdmin && !isCreator && !isAssignee && !onTeam) {
      // Check explicit CasePermission
      const perm = await prisma.casePermission.findUnique({
        where: { caseId_userId: { caseId, userId: session.user.id } },
        select: { accessLevel: true, expiresAt: true },
      });
      const hasExplicitAccess = perm != null && (!perm.expiresAt || perm.expiresAt > new Date());
      if (!hasExplicitAccess) {
        return { c, allowed: false as const, canWrite: false };
      }
    }
  }

  // Write gate — OBSERVER can only write if they have an explicit WRITE permission
  let canWrite = session.user.role !== "OBSERVER";
  if (!canWrite) {
    const perm = await prisma.casePermission.findUnique({
      where: { caseId_userId: { caseId, userId: session.user.id } },
      select: { accessLevel: true, expiresAt: true },
    });
    canWrite = perm != null
      && perm.accessLevel === "WRITE"
      && (!perm.expiresAt || perm.expiresAt > new Date());
  }

  return { c, allowed: true as const, canWrite };
}
